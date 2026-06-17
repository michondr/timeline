<?php

namespace App\Service;

use App\Entity\Category;
use App\Entity\Event;
use App\Entity\User;
use App\Repository\AbsIntegrationRepository;
use App\Repository\CategoryRepository;
use App\Repository\EventRepository;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Produces continuous, importable JSON backups of a user's timeline.
 *
 * Only the user-owned, client-encrypted data is exported (events + categories);
 * their `name`/`note` fields stay as the stored ciphertext, so a round-trip
 * import on an instance holding the same passphrase-derived key restores the
 * plaintext. Server-synced data (habits, books, todos) is intentionally
 * excluded — it is re-syncable from its source.
 */
class ExportService
{
    public const FORMAT  = 'timeline-export';
    public const VERSION = 1;

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly EventRepository $events,
        private readonly CategoryRepository $categories,
        private readonly AbsIntegrationRepository $abs,
        private readonly string $exportDir,
    ) {}

    /**
     * Run an export for a single user.
     *
     * Compares the freshly-built body against the most recent full dump. If the
     * data is unchanged, writes a tiny `{}` placeholder with a `_no_change`
     * suffix; otherwise writes the full dump.
     *
     * @return array{path: string, file: string, changed: bool}
     */
    public function exportUser(User $user): array
    {
        if (!is_dir($this->exportDir)) {
            mkdir($this->exportDir, 0775, true);
        }

        $userId = $user->getId();
        $body   = $this->buildBody($user);
        $stamp  = (new \DateTimeImmutable())->format('Y-m-d\TH-i-s');

        $previous = $this->readLastFullBody($userId);
        $changed  = $previous === null || !$this->bodyEquals($previous, $body);

        if (!$changed) {
            $file = sprintf('timeline_export_user_%s_date_%s_no_change.json', $userId, $stamp);
            file_put_contents($this->exportDir . '/' . $file, "{}\n");

            return ['path' => $this->exportDir . '/' . $file, 'file' => $file, 'changed' => false];
        }

        $payload = [
            'header' => $this->buildHeader($user, $body),
            'body'   => $body,
        ];

        $file = sprintf('timeline_export_user_%s_date_%s.json', $userId, $stamp);
        file_put_contents(
            $this->exportDir . '/' . $file,
            json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n",
        );

        return ['path' => $this->exportDir . '/' . $file, 'file' => $file, 'changed' => true];
    }

    /**
     * Body holds the two encrypted, user-owned collections. Rows are sorted by
     * id so the diff against the previous dump is stable.
     *
     * @return array{categories: list<array<string,mixed>>, events: list<array<string,mixed>>}
     */
    private function buildBody(User $user): array
    {
        $categories = $this->categories->findBy(['user' => $user]);
        usort($categories, fn(Category $a, Category $b) => strcmp((string) $a->getId(), (string) $b->getId()));

        $events = $this->events->findByUser($user);
        usort($events, fn(Event $a, Event $b) => strcmp((string) $a->getId(), (string) $b->getId()));

        return [
            'categories' => array_map(fn(Category $c) => [
                'id'         => $c->getId(),
                'name'       => $c->getName(),
                'color'      => $c->getColor(),
                'isSystem'   => $c->isSystem(),
                'systemSlug' => $c->getSystemSlug(),
            ], $categories),
            'events' => array_map(fn(Event $e) => [
                'id'           => $e->getId(),
                'categoryId'   => $e->getCategory()->getId(),
                'name'         => $e->getName(),
                'type'         => $e->getType(),
                'startDate'    => $e->getStartDate()?->format('Y-m-d'),
                'endDate'      => $e->getEndDate()?->format('Y-m-d'),
                'notifyForEnd' => $e->isNotifyForEnd(),
                'note'         => $e->getNote(),
                'rangeEventId' => $e->getRangeEvent()?->getId(),
                'createdAt'    => $e->getCreatedAt()->format(\DateTimeInterface::ATOM),
                'updatedAt'    => $e->getUpdatedAt()->format(\DateTimeInterface::ATOM),
            ], $events),
        ];
    }

    /** @param array{categories: array, events: array} $body */
    private function buildHeader(User $user, array $body): array
    {
        $habitSync = $this->em->getRepository(\App\Entity\HabitSync::class)->findOneBy(['user' => $user]);
        $absInt    = $this->abs->findForUser($user);

        return [
            'format'     => self::FORMAT,
            'version'    => self::VERSION,
            'exportedAt' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
            'userId'     => $user->getId(),
            'encrypted'  => true,
            'counts'     => [
                'categories' => count($body['categories']),
                'events'     => count($body['events']),
            ],
            'integrations' => [
                'habits' => [
                    'configured'    => $habitSync?->getSessionToken() ? true : false,
                    'lastRunAt'     => $habitSync?->getLastRunAt()?->format(\DateTimeInterface::ATOM),
                    'lastRunStatus' => $habitSync?->getLastRunStatus(),
                ],
                'abs' => [
                    'configured'    => $absInt?->getUrl() && $absInt?->getToken() ? true : false,
                    'lastRunAt'     => $absInt?->getLastRunAt()?->format(\DateTimeInterface::ATOM),
                    'lastRunStatus' => $absInt?->getLastRunStatus(),
                ],
            ],
        ];
    }

    /** Reads the body of the most recent full (non-`no_change`) dump for a user. */
    private function readLastFullBody(string $userId): ?array
    {
        if (!is_dir($this->exportDir)) {
            return null;
        }

        $prefix = sprintf('timeline_export_user_%s_date_', $userId);
        $files  = [];
        foreach (scandir($this->exportDir) ?: [] as $name) {
            if (str_starts_with($name, $prefix) && str_ends_with($name, '.json') && !str_ends_with($name, '_no_change.json')) {
                $files[] = $name;
            }
        }
        if (!$files) {
            return null;
        }

        sort($files); // timestamp in name sorts chronologically
        $latest  = end($files);
        $decoded = json_decode((string) file_get_contents($this->exportDir . '/' . $latest), true);

        return is_array($decoded['body'] ?? null) ? $decoded['body'] : null;
    }

    private function bodyEquals(array $a, array $b): bool
    {
        return json_encode($a) === json_encode($b);
    }
}
