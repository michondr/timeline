<?php

namespace App\Controller;

use App\Entity\HabitSync;
use App\Message\SyncTickTickMessage;
use App\Repository\HabitLogRepository;
use App\Repository\HabitRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/habits', name: 'api_habits_')]
class HabitController extends AbstractController
{
    #[Route('', name: 'list', methods: ['GET'])]
    public function list(
        Request $request,
        HabitRepository $habitRepo,
        HabitLogRepository $logRepo,
    ): JsonResponse {
        $user   = $this->getUser();
        $habits = $habitRepo->findByUser($user);

        $from = $request->query->get('from');
        $to   = $request->query->get('to');

        try {
            $fromDate = new \DateTimeImmutable($from ?? '-1 year');
            $toDate   = new \DateTimeImmutable($to   ?? 'today');
        } catch (\Throwable) {
            return $this->json(['error' => 'Invalid date range'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $logs = $logRepo->findByHabitsAndRange($habits, $fromDate, $toDate);

        // Index logs by habitId → date
        $logMap = [];
        foreach ($logs as $log) {
            $habitId           = $log->getHabit()->getId();
            $dateKey           = $log->getDate()->format('Y-m-d');
            $logMap[$habitId][$dateKey] = $log->getStatus();
        }

        $result = array_map(fn($h) => [
            'id'        => $h->getId(),
            'name'      => $h->getName(),
            'color'     => $h->getColor(),
            'startDate' => $h->getStartDate()?->format('Y-m-d'),
            'logs'      => $logMap[$h->getId()] ?? [],
        ], $habits);

        return $this->json(array_values($result));
    }

    #[Route('/integration', name: 'integration_get', methods: ['GET'])]
    public function integrationGet(EntityManagerInterface $em): JsonResponse
    {
        $sync = $em->getRepository(HabitSync::class)->findOneBy(['user' => $this->getUser()]);

        return $this->json([
            'hasToken'      => $sync && $sync->getSessionToken() !== null,
            'lastRunAt'     => $sync?->getLastRunAt()?->format(\DateTimeInterface::ATOM),
            'lastRunStatus' => $sync?->getLastRunStatus(),
            'lastRunError'  => $sync?->getLastRunError(),
        ]);
    }

    #[Route('/integration', name: 'integration_put', methods: ['PUT'])]
    public function integrationPut(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $data  = json_decode($request->getContent(), true);
        $token = trim((string) ($data['sessionToken'] ?? ''));

        $sync = $em->getRepository(HabitSync::class)->findOneBy(['user' => $this->getUser()]);
        if (!$sync) {
            $sync = (new HabitSync())->setUser($this->getUser());
            $em->persist($sync);
        }

        $sync->setSessionToken($token ?: null);
        $em->flush();

        return $this->json(['ok' => true]);
    }

    #[Route('/sync', name: 'sync', methods: ['POST'])]
    public function sync(EntityManagerInterface $em, MessageBusInterface $bus): JsonResponse
    {
        $sync = $em->getRepository(HabitSync::class)->findOneBy(['user' => $this->getUser()]);

        if (!$sync || !$sync->getSessionToken()) {
            return $this->json(['error' => 'No session token configured'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $bus->dispatch(new SyncTickTickMessage($this->getUser()->getId()));

        return $this->json(['ok' => true]);
    }
}
