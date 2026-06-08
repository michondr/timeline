<?php

namespace App\MessageHandler;

use App\Entity\Habit;
use App\Entity\HabitLog;
use App\Message\SyncTickTickMessage;
use App\Repository\HabitLogRepository;
use App\Repository\HabitRepository;
use App\Repository\HabitSyncRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
class SyncTickTickHandler
{
    private const API = 'https://api.ticktick.com';

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly HabitRepository $habitRepo,
        private readonly HabitLogRepository $habitLogRepo,
        private readonly HabitSyncRepository $syncRepo,
    ) {}

    public function __invoke(SyncTickTickMessage $message): void
    {
        $user = $this->em->getRepository(\App\Entity\User::class)->find($message->userId);
        if (!$user) {
            return;
        }

        $sessionToken = $this->syncRepo->sessionToken($user);
        if (!$sessionToken) {
            return;
        }

        $status = 'ok';
        $error  = null;

        try {
            $this->doSync($user, $sessionToken);
        } catch (\Throwable $e) {
            $status = 'error';
            $error  = $e->getMessage();
        }

        // Use DBAL directly — the ORM EntityManager may be closed after a DB error in doSync
        try {
            $conn = $this->em->getConnection();
            if (!$conn->isConnected()) {
                $conn->connect();
            }
            $conn->executeStatement(
                'UPDATE habit_sync SET last_run_at = NOW(), last_run_status = ?, last_run_error = ? WHERE user_id = ?',
                [$status, $error, $user->getId()],
            );
        } catch (\Throwable) {
            // If even DBAL fails, silently ignore — next run will overwrite
        }
    }

    private function doSync(\App\Entity\User $user, string $sessionToken): void
    {
        $cookie = trim($sessionToken);

        // Extract CSRF token — TickTick requires it as a separate header
        $csrf = '';
        if (preg_match('/_csrf_token=([^;]+)/', $cookie, $m)) {
            $csrf = trim($m[1]);
        }

        $baseHeaders = [
            'Cookie: ' . $cookie,
            'Accept: application/json, text/plain, */*',
            'Accept-Language: en-US,en;q=0.9',
            'Origin: https://www.ticktick.com',
            'Referer: https://www.ticktick.com/',
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
            'Hl: en_US',
            'Sec-Fetch-Dest: empty',
            'Sec-Fetch-Mode: cors',
            'Sec-Fetch-Site: same-site',
        ];
        if ($csrf !== '') {
            $baseHeaders[] = 'X-Crsftoken: ' . $csrf;
        }

        // 1. Fetch habits list
        $rawHabits = $this->curlGet(self::API . '/api/v2/habits', $baseHeaders);

        if (empty($rawHabits)) {
            return;
        }

        // 2. Upsert active habits, remove archived ones
        $activeIds = [];
        $habits    = [];

        foreach ($rawHabits as $raw) {
            // Skip archived habits (archivedTime set, or status !== 0)
            if (!empty($raw['archivedTime']) || (isset($raw['status']) && (int) $raw['status'] !== 0)) {
                continue;
            }

            $ticktickId  = $raw['id'];
            $activeIds[] = $ticktickId;

            $habit = $this->habitRepo->findByTicktickId($user, $ticktickId);
            if (!$habit) {
                $habit = (new Habit())->setUser($user)->setTicktickId($ticktickId);
                $this->em->persist($habit);
            }

            $habit->setName($raw['name'] ?? 'Habit')
                  ->setColor($raw['color'] ?? '#ff9f0a');

            if (!empty($raw['startDate'])) {
                try {
                    $habit->setStartDate(new \DateTimeImmutable($raw['startDate']));
                } catch (\Throwable) {}
            }

            $habits[$ticktickId] = $habit;
        }

        // Remove any previously-synced habits that are now archived
        foreach ($this->habitRepo->findByUser($user) as $existing) {
            if (!in_array($existing->getTicktickId(), $activeIds, true)) {
                $this->em->remove($existing);
            }
        }

        $this->em->flush();

        // 3. Fetch checkins — full history for new habits, last 14 days for existing ones
        $postHeaders  = array_merge($baseHeaders, ['Content-Type: application/json;charset=UTF-8']);
        $recentStamp  = (int) (new \DateTimeImmutable('-14 days'))->format('Ymd');

        $newIds      = [];
        $existingIds = [];
        foreach ($habits as $ticktickId => $habit) {
            if ($this->habitLogRepo->hasAnyLog($habit)) {
                $existingIds[] = $ticktickId;
            } else {
                $newIds[] = $ticktickId;
            }
        }

        $checkinMap = [];

        if (!empty($existingIds)) {
            $body       = $this->curlPost(
                self::API . '/api/v2/habitCheckins/query',
                $postHeaders,
                ['habitIds' => $existingIds, 'afterStamp' => $recentStamp],
            );
            $checkinMap = array_merge($checkinMap, $body['checkins'] ?? $body['habitRecords'] ?? []);
        }

        if (!empty($newIds)) {
            $earliest = new \DateTimeImmutable('-10 years');
            foreach ($newIds as $ticktickId) {
                $sd = $habits[$ticktickId]->getStartDate();
                if ($sd && $sd > $earliest) {
                    $earliest = $sd;
                }
            }
            $body       = $this->curlPost(
                self::API . '/api/v2/habitCheckins/query',
                $postHeaders,
                ['habitIds' => $newIds, 'afterStamp' => (int) $earliest->format('Ymd')],
            );
            $checkinMap = array_merge($checkinMap, $body['checkins'] ?? $body['habitRecords'] ?? []);
        }

        // 4. Upsert logs
        foreach ($checkinMap as $ticktickId => $checkins) {
            $habit = $habits[$ticktickId] ?? null;
            if (!$habit) {
                continue;
            }

            foreach ($checkins as $checkin) {
                $stamp = (string) ($checkin['checkinStamp'] ?? $checkin['stamp'] ?? '');
                if (strlen($stamp) !== 8) {
                    continue;
                }

                $date = \DateTimeImmutable::createFromFormat('Ymd', $stamp);
                if (!$date) {
                    continue;
                }
                $date = $date->setTime(0, 0, 0);

                $status = $this->mapStatus((int) ($checkin['status'] ?? 0));

                $log = $this->habitLogRepo->findOneByHabitAndDate($habit, $date);
                if (!$log) {
                    $log = (new HabitLog())->setHabit($habit)->setDate($date);
                    $this->em->persist($log);
                }
                $log->setStatus($status);
            }
        }

        $this->em->flush();
    }

    /** @return array<mixed> */
    private function curlGet(string $url, array $headers): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTPHEADER     => $headers,
        ]);
        $body   = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($status !== 200) {
            throw new \RuntimeException('TickTick habits API returned ' . $status);
        }

        return json_decode($body, true) ?? [];
    }

    /** @return array<mixed> */
    private function curlPost(string $url, array $headers, array $payload): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => $headers,
        ]);
        $body   = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($status !== 200) {
            throw new \RuntimeException('TickTick checkin API returned ' . $status . ': ' . $body);
        }

        return json_decode($body, true) ?? [];
    }

    private function mapStatus(int $raw): string
    {
        return match ($raw) {
            2       => HabitLog::STATUS_DONE,
            1       => HabitLog::STATUS_FAIL,
            default => HabitLog::STATUS_SKIP,
        };
    }
}
