<?php

namespace App\Repository;

use App\Entity\Habit;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class HabitRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Habit::class);
    }

    /** @return Habit[] */
    public function findByUser(User $user): array
    {
        return $this->findBy(['user' => $user]);
    }

    public function findByTicktickId(User $user, string $ticktickId): ?Habit
    {
        return $this->findOneBy(['user' => $user, 'ticktickId' => $ticktickId]);
    }
}
