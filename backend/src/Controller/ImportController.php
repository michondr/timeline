<?php

namespace App\Controller;

use App\Entity\Category;
use App\Entity\Event;
use App\Repository\CategoryRepository;
use App\Service\ExportService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/import', name: 'api_import_')]
class ImportController extends AbstractController
{
    /**
     * Import a timeline-export dump into the current user's account.
     *
     * Rows keep their stored ciphertext (events `name`/`note`, category `name`),
     * so they decrypt correctly only on an instance holding the same
     * passphrase-derived key. UUIDs are regenerated (the id generator is
     * server-side), while intra-dump links (`categoryId`, `rangeEventId`) are
     * remapped so relationships survive. The import is additive — it never
     * deletes existing data.
     */
    #[Route('', name: 'run', methods: ['POST'])]
    public function import(
        Request $request,
        CategoryRepository $categoryRepo,
        EntityManagerInterface $em,
    ): JsonResponse {
        // Accept either a raw JSON body or a multipart file upload under "file".
        $raw = $request->getContent();
        if (($file = $request->files->get('file')) !== null) {
            $raw = (string) file_get_contents($file->getPathname());
        }

        $data = json_decode($raw, true);
        if (!is_array($data) || ($data['header']['format'] ?? null) !== ExportService::FORMAT) {
            return $this->json(['error' => 'Not a timeline-export file'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $version = (int) ($data['header']['version'] ?? 0);
        if ($version > ExportService::VERSION) {
            return $this->json(['error' => "Unsupported export version {$version}"], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $user       = $this->getUser();
        $categories = $data['body']['categories'] ?? [];
        $events     = $data['body']['events'] ?? [];

        // Pre-index existing system categories so we never duplicate them.
        $existingBySlug = [];
        foreach ($categoryRepo->findBy(['user' => $user]) as $c) {
            if ($c->getSystemSlug()) {
                $existingBySlug[$c->getSystemSlug()] = $c;
            }
        }

        // ── Categories ──────────────────────────────────────────────────────
        $catMap = []; // old id => Category
        foreach ($categories as $row) {
            if (empty($row['id'])) {
                continue;
            }

            $slug = $row['systemSlug'] ?? null;
            if ($slug && isset($existingBySlug[$slug])) {
                $catMap[$row['id']] = $existingBySlug[$slug];
                continue;
            }

            $category = (new Category())
                ->setUser($user)
                ->setName((string) ($row['name'] ?? ''))
                ->setColor((string) ($row['color'] ?? '#888888'))
                ->setIsSystem((bool) ($row['isSystem'] ?? false))
                ->setSystemSlug($slug);

            $em->persist($category);
            $catMap[$row['id']] = $category;
        }

        // ── Events (pass 1: create, remembering id mapping) ──────────────────
        $eventMap   = []; // old id => Event
        $rangeLinks = []; // old event id => old rangeEvent id
        foreach ($events as $row) {
            if (empty($row['id']) || empty($row['categoryId']) || !isset($catMap[$row['categoryId']])) {
                continue;
            }

            $event = (new Event())
                ->setUser($user)
                ->setCategory($catMap[$row['categoryId']])
                ->setName((string) ($row['name'] ?? ''))
                ->setType((string) ($row['type'] ?? Event::TYPE_RANGE))
                ->setNotifyForEnd((bool) ($row['notifyForEnd'] ?? false))
                ->setNote($row['note'] ?? null);

            if (!empty($row['startDate'])) {
                $event->setStartDate(new \DateTimeImmutable($row['startDate']));
            }
            if (!empty($row['endDate'])) {
                $event->setEndDate(new \DateTimeImmutable($row['endDate']));
            }

            $em->persist($event);
            $eventMap[$row['id']] = $event;

            if (!empty($row['rangeEventId'])) {
                $rangeLinks[$row['id']] = $row['rangeEventId'];
            }
        }

        // ── Events (pass 2: resolve rangeEvent links) ────────────────────────
        foreach ($rangeLinks as $oldId => $oldRangeId) {
            if (isset($eventMap[$oldId], $eventMap[$oldRangeId])) {
                $eventMap[$oldId]->setRangeEvent($eventMap[$oldRangeId]);
            }
        }

        $em->flush();

        return $this->json([
            'imported' => [
                'categories' => count($catMap),
                'events'     => count($eventMap),
            ],
        ]);
    }
}
