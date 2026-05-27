<?php

namespace App\Controller;

use App\Entity\Event;
use App\Repository\CategoryRepository;
use App\Repository\EventRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/events', name: 'api_events_')]
class EventController extends AbstractController
{
    #[Route('', name: 'list', methods: ['GET'])]
    public function list(EventRepository $repo): JsonResponse
    {
        $events = $repo->findByUser($this->getUser());

        return $this->json(array_map(fn(Event $e) => $this->serialize($e), $events));
    }

    #[Route('/pending', name: 'pending', methods: ['GET'])]
    public function pending(EventRepository $repo): JsonResponse
    {
        $events = $repo->findPendingByUser($this->getUser());

        return $this->json(array_map(fn(Event $e) => $this->serialize($e), $events));
    }

    #[Route('', name: 'create', methods: ['POST'])]
    public function create(
        Request $request,
        CategoryRepository $categoryRepo,
        EntityManagerInterface $em,
    ): JsonResponse {
        $data = json_decode($request->getContent(), true);

        if (empty($data['name']) || empty($data['categoryId'])) {
            return $this->json(['error' => 'name and categoryId are required'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $category = $categoryRepo->find($data['categoryId']);
        if (!$category || $category->getUser() !== $this->getUser()) {
            return $this->json(['error' => 'Category not found'], Response::HTTP_NOT_FOUND);
        }

        $event = (new Event())
            ->setUser($this->getUser())
            ->setCategory($category)
            ->setName($data['name'])
            ->setType($data['type'] ?? Event::TYPE_RANGE)
            ->setNotifyForEnd($data['notifyForEnd'] ?? false)
            ->setNote($data['note'] ?? null);

        if (!empty($data['startDate'])) {
            $event->setStartDate(new \DateTimeImmutable($data['startDate']));
        }
        if (!empty($data['endDate'])) {
            $event->setEndDate(new \DateTimeImmutable($data['endDate']));
        }

        $em->persist($event);
        $em->flush();

        return $this->json($this->serialize($event), Response::HTTP_CREATED);
    }

    #[Route('/{id}', name: 'update', methods: ['PUT', 'PATCH'])]
    public function update(
        string $id,
        Request $request,
        EventRepository $repo,
        CategoryRepository $categoryRepo,
        EntityManagerInterface $em,
    ): JsonResponse {
        $event = $repo->find($id);

        if (!$event || $event->getUser() !== $this->getUser()) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        $data = json_decode($request->getContent(), true);

        if (isset($data['name'])) {
            $event->setName($data['name']);
        }
        if (isset($data['type'])) {
            $event->setType($data['type']);
        }
        if (isset($data['notifyForEnd'])) {
            $event->setNotifyForEnd($data['notifyForEnd']);
        }
        if (array_key_exists('note', $data)) {
            $event->setNote($data['note']);
        }
        if (array_key_exists('startDate', $data)) {
            $event->setStartDate($data['startDate'] ? new \DateTimeImmutable($data['startDate']) : null);
        }
        if (array_key_exists('endDate', $data)) {
            $event->setEndDate($data['endDate'] ? new \DateTimeImmutable($data['endDate']) : null);
        }
        if (!empty($data['categoryId'])) {
            $category = $categoryRepo->find($data['categoryId']);
            if ($category && $category->getUser() === $this->getUser()) {
                $event->setCategory($category);
            }
        }

        $em->flush();

        return $this->json($this->serialize($event));
    }

    #[Route('/{id}', name: 'delete', methods: ['DELETE'])]
    public function delete(string $id, EventRepository $repo, EntityManagerInterface $em): JsonResponse
    {
        $event = $repo->find($id);

        if (!$event || $event->getUser() !== $this->getUser()) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        $em->remove($event);
        $em->flush();

        return $this->json(null, Response::HTTP_NO_CONTENT);
    }

    private function serialize(Event $e): array
    {
        return [
            'id'           => $e->getId(),
            'categoryId'   => $e->getCategory()->getId(),
            'name'         => $e->getName(),
            'type'         => $e->getType(),
            'startDate'    => $e->getStartDate()?->format('Y-m-d'),
            'endDate'      => $e->getEndDate()?->format('Y-m-d'),
            'notifyForEnd' => $e->isNotifyForEnd(),
            'note'         => $e->getNote(),
            'createdAt'    => $e->getCreatedAt()->format(\DateTimeInterface::ATOM),
            'updatedAt'    => $e->getUpdatedAt()->format(\DateTimeInterface::ATOM),
        ];
    }
}
