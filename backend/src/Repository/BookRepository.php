<?php

namespace App\Repository;

use App\Entity\Book;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class BookRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Book::class);
    }

    /** @return Book[] */
    public function findByUser(User $user): array
    {
        return $this->findBy(['user' => $user], ['startedAt' => 'ASC']);
    }

    public function findOneByAbsItemId(User $user, string $absItemId): ?Book
    {
        return $this->findOneBy(['user' => $user, 'absItemId' => $absItemId]);
    }
}
