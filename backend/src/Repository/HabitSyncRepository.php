<?php

namespace App\Repository;

use App\Entity\HabitSync;
use App\Entity\User;
use App\Service\EncryptionService;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<HabitSync>
 */
class HabitSyncRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry, private readonly EncryptionService $enc)
    {
        parent::__construct($registry, HabitSync::class);
    }

    public function findForUser(User $user): ?HabitSync
    {
        return $this->findOneBy(['user' => $user]);
    }

    public function sessionToken(User $user): ?string
    {
        $sync = $this->findForUser($user);

        return $this->enc->decrypt($sync?->getSessionToken());
    }

    public function saveToken(User $user, ?string $token, EntityManagerInterface $em): HabitSync
    {
        $sync = $this->findForUser($user) ?? (new HabitSync())->setUser($user);
        $sync->setSessionToken($token ? $this->enc->encrypt($token) : null);
        $em->persist($sync);
        $em->flush();

        return $sync;
    }
}
