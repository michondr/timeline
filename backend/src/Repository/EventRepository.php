<?php

namespace App\Repository;

use App\Entity\Event;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Event>
 */
class EventRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Event::class);
    }

    /** @return Event[] */
    public function findByUser(User $user): array
    {
        return $this->createQueryBuilder('e')
            ->andWhere('e.user = :user')
            ->setParameter('user', $user)
            ->orderBy('e.startDate', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** @return Event[] Events with notifyForEnd=true and no endDate yet. */
    public function findPendingByUser(User $user): array
    {
        return $this->createQueryBuilder('e')
            ->andWhere('e.user = :user')
            ->andWhere('e.notifyForEnd = true')
            ->andWhere('e.endDate IS NULL')
            ->setParameter('user', $user)
            ->orderBy('e.startDate', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
