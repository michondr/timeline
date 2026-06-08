<?php

namespace App\Controller;

use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class HealthController extends AbstractController
{
    public function __construct(private readonly HttpClientInterface $http) {}

    #[Route('/api/health', name: 'api_health', methods: ['GET'])]
    public function health(Connection $conn): JsonResponse
    {
        $services = [];

        // Database
        try {
            $conn->executeQuery('SELECT 1');
            $services[] = ['name' => 'database', 'status' => 'ok'];
        } catch (\Throwable) {
            $services[] = ['name' => 'database', 'status' => 'error'];
        }

        // Messenger — any message delivered to a worker but not finished for >5 min means a crashed worker
        try {
            $stuck = (int) $conn->fetchOne(
                "SELECT COUNT(*) FROM messenger_messages
                 WHERE delivered_at IS NOT NULL
                   AND delivered_at < NOW() - INTERVAL '5 minutes'"
            );
            $services[] = ['name' => 'messenger', 'status' => $stuck === 0 ? 'ok' : 'error'];
        } catch (\Throwable) {
            // Table may not exist yet (before first migration) — treat as ok
            $services[] = ['name' => 'messenger', 'status' => 'ok'];
        }

        // Frontend — HTTP ping to the Vite preview container (shared proxy network)
        try {
            $resp = $this->http->request('GET', 'http://timeline-frontend:5173', [
                'timeout' => 3,
            ]);
            $services[] = ['name' => 'frontend', 'status' => $resp->getStatusCode() < 500 ? 'ok' : 'error'];
        } catch (\Throwable) {
            $services[] = ['name' => 'frontend', 'status' => 'error'];
        }

        $allOk = array_reduce($services, fn($c, $s) => $c && $s['status'] === 'ok', true);

        return $this->json(['services' => $services], $allOk ? 200 : 503);
    }
}
