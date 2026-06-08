<?php

namespace App\Repository;

use App\Entity\AbsIntegration;
use App\Entity\User;
use App\Service\EncryptionService;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<AbsIntegration>
 */
class AbsIntegrationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry, private readonly EncryptionService $enc)
    {
        parent::__construct($registry, AbsIntegration::class);
    }

    public function findForUser(User $user): ?AbsIntegration
    {
        return $this->findOneBy(['user' => $user]);
    }

    /** @return array{url: string, token: string}|null */
    public function credentials(User $user): ?array
    {
        $i   = $this->findForUser($user);
        $url = $this->enc->decrypt($i?->getUrl());
        $tok = $this->enc->decrypt($i?->getToken());

        return ($url && $tok) ? ['url' => $url, 'token' => $tok] : null;
    }

    public function saveCredentials(User $user, string $url, string $token, EntityManagerInterface $em): AbsIntegration
    {
        $i = $this->findForUser($user) ?? (new AbsIntegration())->setUser($user);
        $i->setUrl($this->enc->encrypt($url))->setToken($this->enc->encrypt($token));
        $em->persist($i);
        $em->flush();

        return $i;
    }
}
