<?php

namespace App\Controller;

use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

class HealthController extends AbstractController
{
    #[Route('/api/health', name: 'api_health', methods: ['GET'])]
    public function health(Connection $conn): JsonResponse
    {
        $services = [];

        try {
            $conn->executeQuery('SELECT 1');
            $services[] = ['name' => 'database', 'status' => 'ok'];
        } catch (\Throwable) {
            $services[] = ['name' => 'database', 'status' => 'error'];
        }

        $allOk = array_reduce($services, fn($c, $s) => $c && $s['status'] === 'ok', true);

        return $this->json(['services' => $services], $allOk ? 200 : 503);
    }
}
