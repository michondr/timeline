<?php

namespace App\Repository;

use App\Entity\Habit;
use App\Entity\HabitLog;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class HabitLogRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, HabitLog::class);
    }

    /**
     * @param Habit[] $habits
     * @return HabitLog[]
     */
    public function findByHabitsAndRange(array $habits, \DateTimeImmutable $from, \DateTimeImmutable $to): array
    {
        if (empty($habits)) {
            return [];
        }

        return $this->createQueryBuilder('l')
            ->where('l.habit IN (:habits)')
            ->andWhere('l.date >= :from')
            ->andWhere('l.date <= :to')
            ->setParameter('habits', $habits)
            ->setParameter('from', $from)
            ->setParameter('to', $to)
            ->getQuery()
            ->getResult();
    }

    public function findOneByHabitAndDate(Habit $habit, \DateTimeImmutable $date): ?HabitLog
    {
        return $this->findOneBy(['habit' => $habit, 'date' => $date]);
    }

    public function hasAnyLog(Habit $habit): bool
    {
        return $this->createQueryBuilder('l')
            ->select('1')
            ->where('l.habit = :habit')
            ->setParameter('habit', $habit)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult() !== null;
    }
}
