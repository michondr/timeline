<?php

namespace App\Controller;

use App\Entity\Book;
use App\Message\SyncAbsMessage;
use App\Repository\AbsIntegrationRepository;
use App\Repository\BookRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/abs', name: 'api_abs_')]
class AbsController extends AbstractController
{
    #[Route('/integration', name: 'integration_get', methods: ['GET'])]
    public function getIntegration(AbsIntegrationRepository $repo): JsonResponse
    {
        $i    = $repo->findForUser($this->getUser());
        $cred = $repo->credentials($this->getUser());

        return $this->json([
            'hasCredentials' => $cred !== null,
            'url'            => $cred['url'] ?? '',
            'lastRunAt'      => $i?->getLastRunAt()?->format(\DateTimeInterface::ATOM),
            'lastRunStatus'  => $i?->getLastRunStatus(),
            'lastRunError'   => $i?->getLastRunError(),
        ]);
    }

    #[Route('/integration', name: 'integration_put', methods: ['PUT'])]
    public function putIntegration(Request $request, AbsIntegrationRepository $repo, EntityManagerInterface $em): JsonResponse
    {
        $data  = json_decode($request->getContent(), true) ?? [];
        $url   = rtrim(trim((string) ($data['url']   ?? '')), '/');
        $token = trim((string) ($data['token'] ?? ''));

        if (!$url || !$token) {
            return $this->json(['error' => 'url and token are required'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $test = $this->testConnection($url, $token);
        if (!$test['ok']) {
            return $this->json(['error' => $test['error']], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $repo->saveCredentials($this->getUser(), $url, $token, $em);

        return $this->json(['ok' => true]);
    }

    #[Route('/sync', name: 'sync', methods: ['POST'])]
    public function sync(AbsIntegrationRepository $repo, MessageBusInterface $bus): JsonResponse
    {
        if ($repo->credentials($this->getUser()) === null) {
            return $this->json(['error' => 'No ABS credentials configured'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        $bus->dispatch(new SyncAbsMessage($this->getUser()->getId()));
        return $this->json(['ok' => true]);
    }

    #[Route('/books', name: 'books', methods: ['GET'])]
    public function books(BookRepository $repo): JsonResponse
    {
        $all        = $repo->findByUser($this->getUser());
        $finished   = array_filter($all, fn(Book $b) =>  $b->isFinished());
        $unfinished = array_filter($all, fn(Book $b) => !$b->isFinished());

        usort($unfinished, fn(Book $a, Book $b) => $b->getStartedAt() <=> $a->getStartedAt());
        $books = [...$finished, ...array_slice($unfinished, 0, 2)];

        return $this->json(array_values(array_map(fn(Book $b) => [
            'id'          => $b->getId(),
            'absItemId'   => $b->getAbsItemId(),
            'title'       => $b->getTitle(),
            'author'      => $b->getAuthor(),
            'startedAt'   => $b->getStartedAt()?->format('Y-m-d'),
            'finishedAt'  => $b->getFinishedAt()?->format('Y-m-d'),
            'isFinished'  => $b->isFinished(),
            'currentTime' => $b->getCurrentTime(),
        ], $books)));
    }

    private function testConnection(string $url, string $token): array
    {
        $ch = curl_init("{$url}/api/me");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTPHEADER     => ["Authorization: Bearer {$token}", 'Accept: application/json'],
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
        ]);
        $result  = curl_exec($ch);
        $status  = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = $result === false ? curl_error($ch) : '';
        curl_close($ch);

        if ($status === 200) return ['ok' => true];
        $msg = match($status) {
            0   => $curlErr ? "Could not connect: {$curlErr}" : 'Could not connect — check the URL',
            401 => 'Invalid token',
            403 => 'Access denied',
            default => "Server returned {$status}",
        };
        return ['ok' => false, 'error' => $msg];
    }
}
