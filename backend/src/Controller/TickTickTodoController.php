<?php

namespace App\Controller;

use App\Repository\HabitSyncRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/ticktick', name: 'api_ticktick_')]
class TickTickTodoController extends AbstractController
{
    private const API         = 'https://api.ticktick.com';
    private const TODO_TAG_ID = 'timeline-todo';

    // ── List open todos tagged "timeline-todo" ─────────────────────────────
    #[Route('/todos', name: 'todos_list', methods: ['GET'])]
    public function list(HabitSyncRepository $repo): JsonResponse
    {
        $headers = $this->headers($repo);
        if ($headers === null) {
            return $this->json(['error' => 'No TickTick session configured'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $batch    = $this->curlGet(self::API . '/api/v3/batch/check/0', $headers);
        $allTasks = $batch['syncTaskBean']['update'] ?? [];

        $todos = [];
        foreach ($allTasks as $task) {
            if ((int) ($task['status'] ?? 0) !== 0) {
                continue;
            }
            $taskTags = (array) ($task['tags'] ?? []);
            if (!in_array(self::TODO_TAG_ID, $taskTags, true)) {
                continue;
            }
            $todos[] = [
                'id'        => $task['id'],
                'title'     => $task['title'] ?? '',
                'projectId' => $task['projectId'] ?? '',
            ];
        }

        return $this->json($todos);
    }

    // ── Mark done (status 2) ───────────────────────────────────────────────
    #[Route('/todos/{id}/done', name: 'todos_done', methods: ['POST'])]
    public function done(string $id, Request $request, HabitSyncRepository $repo): JsonResponse
    {
        $headers = $this->headers($repo);
        if ($headers === null) {
            return $this->json(['error' => 'No TickTick session configured'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $data      = json_decode($request->getContent(), true) ?? [];
        $projectId = (string) ($data['projectId'] ?? '');

        $this->curlPost(self::API . '/api/v2/batch/task', $headers, [
            'add'               => [],
            'update'            => [[
                'id'            => $id,
                'projectId'     => $projectId,
                'status'        => 2,
                'completedTime' => gmdate('Y-m-d\TH:i:s.000+0000'),
                'tags'          => [self::TODO_TAG_ID],
                'items'         => [], 'reminders' => [], 'exDate' => [],
            ]],
            'delete'            => [],
            'addAttachments'    => [],
            'updateAttachments' => [],
            'deleteAttachments' => [],
        ]);

        return $this->json(['ok' => true]);
    }

    // ── Won't do (status -1 = abandoned) ─────────────────────────────────
    #[Route('/todos/{id}/wontdo', name: 'todos_wontdo', methods: ['POST'])]
    public function wontDo(string $id, Request $request, HabitSyncRepository $repo): JsonResponse
    {
        $headers = $this->headers($repo);
        if ($headers === null) {
            return $this->json(['error' => 'No TickTick session configured'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $data      = json_decode($request->getContent(), true) ?? [];
        $projectId = (string) ($data['projectId'] ?? '');

        $this->curlPost(self::API . '/api/v2/batch/task', $headers, [
            'add'               => [],
            'update'            => [[
                'id'            => $id,
                'projectId'     => $projectId,
                'status'        => -1,
                'completedTime' => gmdate('Y-m-d\TH:i:s.000+0000'),
                'tags'          => [self::TODO_TAG_ID],
                'items'         => [], 'reminders' => [], 'exDate' => [],
            ]],
            'delete'            => [],
            'addAttachments'    => [],
            'updateAttachments' => [],
            'deleteAttachments' => [],
        ]);

        return $this->json(['ok' => true]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    private function headers(HabitSyncRepository $repo): ?array
    {
        $cookie = $repo->sessionToken($this->getUser());
        if (!$cookie) {
            return null;
        }

        $cookie = trim($cookie);
        $csrf   = '';
        if (preg_match('/_csrf_token=([^;]+)/', $cookie, $m)) {
            $csrf = trim($m[1]);
        }

        // Try to extract device id from cookie (TickTick stores it as `did=<24-hex>`)
        $deviceId = '';
        if (preg_match('/(?:^|;\s*)did=([a-f0-9]{24})/', $cookie, $dm)) {
            $deviceId = $dm[1];
        }

        $xDevice = json_encode([
            'platform' => 'web',
            'os'       => 'Linux x86_64',
            'device'   => 'Firefox 150.0',
            'name'     => '',
            'version'  => 8090,
            'id'       => $deviceId ?: '697d21b2922c1f040d8ea2b7',
            'channel'  => 'website',
            'campaign' => '',
            'websocket'=> '',
        ]);

        return [
            'Cookie: '    . $cookie,
            'Accept: application/json, text/plain, */*',
            'Accept-Language: en-US,en;q=0.9',
            'Origin: https://ticktick.com',
            'Referer: https://ticktick.com/',
            'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0',
            'X-Device: '  . $xDevice,
            'x-tz: Europe/Prague',
            'hl: en_US',
        ];
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
        $body   = (string) curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($status !== 200) {
            throw new \RuntimeException('TickTick API returned ' . $status . ': ' . substr($body, 0, 200));
        }

        return json_decode($body, true) ?? [];
    }

    /** @return array<mixed> */
    private function curlPost(string $url, array $headers, array $payload): array
    {
        $postHeaders = array_merge($headers, ['Content-Type: application/json;charset=UTF-8']);
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => $postHeaders,
        ]);
        $body   = (string) curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($status !== 200) {
            throw new \RuntimeException('TickTick batch API returned ' . $status . ': ' . $body);
        }

        return json_decode($body, true) ?? [];
    }
}
