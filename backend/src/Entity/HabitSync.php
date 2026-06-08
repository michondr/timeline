<?php

namespace App\Entity;

use App\Repository\HabitSyncRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: HabitSyncRepository::class)]
class HabitSync
{
    #[ORM\Id]
    #[ORM\GeneratedValue(strategy: 'CUSTOM')]
    #[ORM\CustomIdGenerator(class: 'doctrine.uuid_generator')]
    #[ORM\Column(type: 'uuid', unique: true)]
    private ?string $id = null;

    #[ORM\OneToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false)]
    private User $user;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $sessionToken = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $lastRunAt = null;

    /** 'ok' | 'error' | null */
    #[ORM\Column(length: 16, nullable: true)]
    private ?string $lastRunStatus = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $lastRunError = null;

    public function getId(): ?string { return $this->id; }

    public function getUser(): User { return $this->user; }
    public function setUser(User $user): static { $this->user = $user; return $this; }

    public function getSessionToken(): ?string { return $this->sessionToken; }
    public function setSessionToken(?string $t): static { $this->sessionToken = $t; return $this; }

    public function getLastRunAt(): ?\DateTimeImmutable { return $this->lastRunAt; }
    public function setLastRunAt(?\DateTimeImmutable $d): static { $this->lastRunAt = $d; return $this; }

    public function getLastRunStatus(): ?string { return $this->lastRunStatus; }
    public function setLastRunStatus(?string $s): static { $this->lastRunStatus = $s; return $this; }

    public function getLastRunError(): ?string { return $this->lastRunError; }
    public function setLastRunError(?string $e): static { $this->lastRunError = $e; return $this; }
}
