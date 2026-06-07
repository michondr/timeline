<?php

namespace App\Entity;

use App\Repository\BookRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: BookRepository::class)]
class Book
{
    #[ORM\Id]
    #[ORM\GeneratedValue(strategy: 'CUSTOM')]
    #[ORM\CustomIdGenerator(class: 'doctrine.uuid_generator')]
    #[ORM\Column(type: 'uuid', unique: true)]
    private ?string $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false)]
    private User $user;

    #[ORM\Column(length: 128)]
    private string $absItemId;

    #[ORM\Column(length: 512)]
    private string $title;

    #[ORM\Column(length: 512, nullable: true)]
    private ?string $author = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $startedAt = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $finishedAt = null;

    #[ORM\Column]
    private bool $isFinished = false;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $lastProgressAt = null;

    public function getId(): ?string { return $this->id; }

    public function getUser(): User { return $this->user; }
    public function setUser(User $user): static { $this->user = $user; return $this; }

    public function getAbsItemId(): string { return $this->absItemId; }
    public function setAbsItemId(string $id): static { $this->absItemId = $id; return $this; }

    public function getTitle(): string { return $this->title; }
    public function setTitle(string $title): static { $this->title = $title; return $this; }

    public function getAuthor(): ?string { return $this->author; }
    public function setAuthor(?string $author): static { $this->author = $author; return $this; }

    public function getStartedAt(): ?\DateTimeImmutable { return $this->startedAt; }
    public function setStartedAt(?\DateTimeImmutable $d): static { $this->startedAt = $d; return $this; }

    public function getFinishedAt(): ?\DateTimeImmutable { return $this->finishedAt; }
    public function setFinishedAt(?\DateTimeImmutable $d): static { $this->finishedAt = $d; return $this; }

    public function isFinished(): bool { return $this->isFinished; }
    public function setIsFinished(bool $v): static { $this->isFinished = $v; return $this; }

    #[ORM\Column(name: '"current_time"', type: 'float', nullable: true)]
    private ?float $currentTime = null;

    public function getLastProgressAt(): ?\DateTimeImmutable { return $this->lastProgressAt; }
    public function setLastProgressAt(?\DateTimeImmutable $d): static { $this->lastProgressAt = $d; return $this; }

    public function getCurrentTime(): ?float { return $this->currentTime; }
    public function setCurrentTime(?float $v): static { $this->currentTime = $v; return $this; }
}
