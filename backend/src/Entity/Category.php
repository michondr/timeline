<?php

namespace App\Entity;

use App\Repository\CategoryRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: CategoryRepository::class)]
class Category
{
    #[ORM\Id]
    #[ORM\GeneratedValue(strategy: 'CUSTOM')]
    #[ORM\CustomIdGenerator(class: 'doctrine.uuid_generator')]
    #[ORM\Column(type: 'uuid', unique: true)]
    private ?string $id = null;

    #[ORM\ManyToOne(targetEntity: User::class, inversedBy: 'categories')]
    #[ORM\JoinColumn(nullable: false)]
    private User $user;

    /** Stored as client-encrypted ciphertext (base64-encoded AES-GCM). */
    #[ORM\Column(type: 'text')]
    private string $name;

    #[ORM\Column(length: 7)]
    private string $color;

    /** System categories (Habits, Books) cannot be renamed or deleted. */
    #[ORM\Column]
    private bool $isSystem = false;

    /** Internal slug used to identify system categories in integrations. */
    #[ORM\Column(length: 32, nullable: true)]
    private ?string $systemSlug = null;

    #[ORM\OneToMany(targetEntity: Event::class, mappedBy: 'category')]
    private Collection $events;

    public function __construct()
    {
        $this->events = new ArrayCollection();
    }

    public function getId(): ?string { return $this->id; }

    public function getUser(): User { return $this->user; }
    public function setUser(User $user): static { $this->user = $user; return $this; }

    public function getName(): string { return $this->name; }
    public function setName(string $name): static { $this->name = $name; return $this; }

    public function getColor(): string { return $this->color; }
    public function setColor(string $color): static { $this->color = $color; return $this; }

    public function isSystem(): bool { return $this->isSystem; }
    public function setIsSystem(bool $isSystem): static { $this->isSystem = $isSystem; return $this; }

    public function getSystemSlug(): ?string { return $this->systemSlug; }
    public function setSystemSlug(?string $slug): static { $this->systemSlug = $slug; return $this; }

    /** @return Collection<int, Event> */
    public function getEvents(): Collection { return $this->events; }
}
