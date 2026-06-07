<?php

namespace App\MessageHandler;

use App\Entity\AbsIntegration;
use App\Entity\Book;
use App\Entity\User;
use App\Message\SyncAbsMessage;
use App\Repository\BookRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
class SyncAbsHandler
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly BookRepository $bookRepo,
    ) {}

    public function __invoke(SyncAbsMessage $message): void
    {
        $user = $this->em->getRepository(User::class)->find($message->userId);
        if (!$user) return;

        $integration = $this->em->getRepository(AbsIntegration::class)->findOneBy(['user' => $user]);
        if (!$integration || !$integration->getUrl() || !$integration->getToken()) return;

        $status = 'ok';
        $error  = null;

        try {
            $this->doSync($user, $integration);
        } catch (\Throwable $e) {
            $status = 'error';
            $error  = $e->getMessage();
        }

        try {
            $conn = $this->em->getConnection();
            if (!$conn->isConnected()) $conn->connect();
            $conn->executeStatement(
                'UPDATE abs_integration SET last_run_at = NOW(), last_run_status = ?, last_run_error = ? WHERE user_id = ?',
                [$status, $error, $user->getId()],
            );
        } catch (\Throwable) {}
    }

    private function doSync(User $user, AbsIntegration $integration): void
    {
        $base  = $integration->getUrl();
        $token = $integration->getToken();

        $me           = $this->apiGet($base, $token, '/api/me');
        $bookProgress = array_filter(
            $me['mediaProgress'] ?? [],
            fn($p) => ($p['mediaItemType'] ?? '') === 'book' && empty($p['episodeId']),
        );

        foreach ($bookProgress as $progress) {
            if (empty($progress['startedAt'])) continue;

            $libraryItemId = $progress['libraryItemId'];

            $item   = $this->apiGet($base, $token, "/api/items/{$libraryItemId}");
            $title  = $item['media']['metadata']['title']
                   ?? $item['media']['metadata']['titleIgnorePrefix']
                   ?? 'Unknown';
            $authors = $item['media']['metadata']['authors'] ?? [];
            $author  = $item['media']['metadata']['authorName']
                    ?? (count($authors) > 0
                        ? implode(', ', array_column($authors, 'name'))
                        : null);

            $startedAt  = $this->msToDate((int) $progress['startedAt']);
            $finishedAt = !empty($progress['finishedAt'])
                            ? $this->msToDate((int) $progress['finishedAt']) : null;
            $isFinished = (bool) ($progress['isFinished'] ?? false);

            $this->downloadCover($base, $token, $libraryItemId);

            $book = $this->bookRepo->findOneByAbsItemId($user, $libraryItemId)
                 ?? (new Book())->setUser($user)->setAbsItemId($libraryItemId);

            $lastProgressAt = !empty($progress['lastUpdate'])
                ? $this->msToDate((int) $progress['lastUpdate']) : null;

            $currentTime = isset($progress['currentTime']) ? (float) $progress['currentTime'] : null;

            $book->setTitle($title)
                 ->setAuthor($author)
                 ->setStartedAt($startedAt)
                 ->setFinishedAt($finishedAt)
                 ->setIsFinished($isFinished)
                 ->setLastProgressAt($lastProgressAt)
                 ->setCurrentTime($currentTime);

            $this->em->persist($book);
        }

        $this->em->flush();
    }

    private function downloadCover(string $base, string $token, string $itemId): void
    {
        $dir  = dirname(__DIR__, 2) . '/public/covers';
        if (!is_dir($dir)) mkdir($dir, 0755, true);

        $path = "{$dir}/{$itemId}.jpg";
        if (file_exists($path)) return;

        $ch = curl_init("{$base}/api/items/{$itemId}/cover?format=jpeg&width=80");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTPHEADER     => ["Authorization: Bearer {$token}"],
            CURLOPT_TIMEOUT        => 10,
        ]);
        $data   = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($status === 200 && $data) {
            file_put_contents($path, $data);
        }
    }

    private function apiGet(string $base, string $token, string $path): array
    {
        $ch = curl_init($base . $path);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTPHEADER     => ["Authorization: Bearer {$token}", 'Accept: application/json'],
            CURLOPT_TIMEOUT        => 30,
        ]);
        $body   = (string) curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($status !== 200) {
            throw new \RuntimeException("ABS API returned {$status} for {$path}: " . substr($body, 0, 120));
        }
        return json_decode($body, true) ?? [];
    }

    private function msToDate(int $ms): \DateTimeImmutable
    {
        return \DateTimeImmutable::createFromFormat('U', (string) (int) ($ms / 1000));
    }
}
