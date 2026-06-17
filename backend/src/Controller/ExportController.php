<?php

namespace App\Controller;

use App\Service\ExportService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/exports', name: 'api_exports_')]
class ExportController extends AbstractController
{
    public function __construct(
        private readonly ExportService $export,
        private readonly string $exportDir,
    ) {}

    /** List the current user's export files, newest first. */
    #[Route('', name: 'list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $prefix = sprintf('timeline_export_user_%s_date_', $this->getUser()->getId());
        $out    = [];

        foreach (scandir(is_dir($this->exportDir) ? $this->exportDir : __DIR__) ?: [] as $name) {
            if (!str_starts_with($name, $prefix) || !str_ends_with($name, '.json')) {
                continue;
            }
            $path  = $this->exportDir . '/' . $name;
            $out[] = [
                'name'      => $name,
                'size'      => filesize($path) ?: 0,
                'createdAt' => date(\DateTimeInterface::ATOM, filemtime($path) ?: time()),
                'noChange'  => str_ends_with($name, '_no_change.json'),
            ];
        }

        usort($out, fn($a, $b) => strcmp($b['name'], $a['name']));

        return $this->json($out);
    }

    /** Trigger an on-demand export for the current user. */
    #[Route('/run', name: 'run', methods: ['POST'])]
    public function run(): JsonResponse
    {
        $result = $this->export->exportUser($this->getUser());

        return $this->json(['file' => $result['file'], 'changed' => $result['changed']]);
    }

    #[Route('/{name}/download', name: 'download', methods: ['GET'])]
    public function download(string $name): Response
    {
        // Reject traversal and confirm ownership via the user-id prefix.
        $prefix = sprintf('timeline_export_user_%s_date_', $this->getUser()->getId());
        if (basename($name) !== $name || !str_starts_with($name, $prefix) || !str_ends_with($name, '.json')) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        $path = $this->exportDir . '/' . $name;
        if (!is_file($path)) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        $response = new BinaryFileResponse($path);
        $response->headers->set('Content-Type', 'application/json');
        $response->setContentDisposition(ResponseHeaderBag::DISPOSITION_ATTACHMENT, $name);

        return $response;
    }
}
