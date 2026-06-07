<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
class AbsIntegration
{
    #[ORM\Id]
    #[ORM\GeneratedValue(strategy: 'CUSTOM')]
    #[ORM\CustomIdGenerator(class: 'doctrine.uuid_generator')]
    #[ORM\Column(type: 'uuid', unique: true)]
    private ?string $id = null;

    #[ORM\OneToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false)]
    private User $user;

    #[ORM\Column(length: 512, nullable: true)]
    private ?string $url = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $token = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $lastRunAt = null;

    #[ORM\Column(length: 16, nullable: true)]
    private ?string $lastRunStatus = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $lastRunError = null;

    public function getId(): ?string { return $this->id; }

    public function getUser(): User { return $this->user; }
    public function setUser(User $user): static { $this->user = $user; return $this; }

    public function getUrl(): ?string { return $this->url; }
    public function setUrl(?string $url): static { $this->url = $url ? rtrim($url, '/') : null; return $this; }

    public function getToken(): ?string { return $this->token; }
    public function setToken(?string $token): static { $this->token = $token; return $this; }

    public function getLastRunAt(): ?\DateTimeImmutable { return $this->lastRunAt; }
    public function setLastRunAt(?\DateTimeImmutable $d): static { $this->lastRunAt = $d; return $this; }

    public function getLastRunStatus(): ?string { return $this->lastRunStatus; }
    public function setLastRunStatus(?string $s): static { $this->lastRunStatus = $s; return $this; }

    public function getLastRunError(): ?string { return $this->lastRunError; }
    public function setLastRunError(?string $e): static { $this->lastRunError = $e; return $this; }
}
