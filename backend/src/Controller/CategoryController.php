<?php

namespace App\Controller;

use App\Entity\Category;
use App\Repository\CategoryRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/categories', name: 'api_categories_')]
class CategoryController extends AbstractController
{
    #[Route('', name: 'list', methods: ['GET'])]
    public function list(CategoryRepository $repo): JsonResponse
    {
        $user       = $this->getUser();
        $categories = $repo->findBy(['user' => $user], ['isSystem' => 'ASC']);

        return $this->json(array_map(fn(Category $c) => $this->serialize($c), $categories));
    }

    #[Route('', name: 'create', methods: ['POST'])]
    public function create(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        if (empty($data['name']) || empty($data['color'])) {
            return $this->json(['error' => 'name and color are required'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $category = (new Category())
            ->setUser($this->getUser())
            ->setName($data['name'])
            ->setColor($data['color']);

        $em->persist($category);
        $em->flush();

        return $this->json($this->serialize($category), Response::HTTP_CREATED);
    }

    #[Route('/{id}', name: 'delete', methods: ['DELETE'])]
    public function delete(string $id, CategoryRepository $repo, EntityManagerInterface $em): JsonResponse
    {
        $category = $repo->find($id);

        if (!$category || $category->getUser() !== $this->getUser()) {
            return $this->json(['error' => 'Not found'], Response::HTTP_NOT_FOUND);
        }

        if ($category->isSystem()) {
            return $this->json(['error' => 'System categories cannot be deleted'], Response::HTTP_FORBIDDEN);
        }

        $em->remove($category);
        $em->flush();

        return $this->json(null, Response::HTTP_NO_CONTENT);
    }

    private function serialize(Category $c): array
    {
        return [
            'id'         => $c->getId(),
            'name'       => $c->getName(),
            'color'      => $c->getColor(),
            'isSystem'   => $c->isSystem(),
            'systemSlug' => $c->getSystemSlug(),
        ];
    }
}
