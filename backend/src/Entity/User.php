<?php

namespace App\Entity;

use App\Repository\UserRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: '`user`')]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    #[ORM\Id]
    #[ORM\GeneratedValue(strategy: 'CUSTOM')]
    #[ORM\CustomIdGenerator(class: 'doctrine.uuid_generator')]
    #[ORM\Column(type: 'uuid', unique: true)]
    private ?string $id = null;

    /** Base64url-encoded random bytes set by the server during passkey registration. */
    #[ORM\Column(length: 64, unique: true)]
    private string $userHandle;

    #[ORM\Column(length: 64)]
    private string $kdfSalt;

    #[ORM\Column(type: 'text')]
    private string $verificationBlob;

    #[ORM\Column(type: 'date_immutable')]
    private \DateTimeImmutable $birthdate;

    #[ORM\Column(length: 255)]
    private string $authKeyHash;

    #[ORM\Column(length: 64, unique: true, nullable: true)]
    private ?string $apiToken = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $passkeyCredentials = null;

    #[ORM\OneToMany(targetEntity: Category::class, mappedBy: 'user', cascade: ['persist', 'remove'])]
    private Collection $categories;

    #[ORM\OneToMany(targetEntity: Event::class, mappedBy: 'user', cascade: ['persist', 'remove'])]
    private Collection $events;

    public function __construct()
    {
        $this->categories = new ArrayCollection();
        $this->events     = new ArrayCollection();
    }

    public function getId(): ?string { return $this->id; }

    public function getUserHandle(): string { return $this->userHandle; }
    public function setUserHandle(string $handle): static { $this->userHandle = $handle; return $this; }

    public function getKdfSalt(): string { return $this->kdfSalt; }
    public function setKdfSalt(string $kdfSalt): static { $this->kdfSalt = $kdfSalt; return $this; }

    public function getVerificationBlob(): string { return $this->verificationBlob; }
    public function setVerificationBlob(string $blob): static { $this->verificationBlob = $blob; return $this; }

    public function getBirthdate(): \DateTimeImmutable { return $this->birthdate; }
    public function setBirthdate(\DateTimeImmutable $birthdate): static { $this->birthdate = $birthdate; return $this; }

    public function getAuthKeyHash(): string { return $this->authKeyHash; }
    public function setAuthKeyHash(string $hash): static { $this->authKeyHash = $hash; return $this; }

    public function getApiToken(): ?string { return $this->apiToken; }
    public function setApiToken(?string $token): static { $this->apiToken = $token; return $this; }

    public function getPasskeyCredentials(): ?string { return $this->passkeyCredentials; }
    public function setPasskeyCredentials(?string $creds): static { $this->passkeyCredentials = $creds; return $this; }

    /** @return Collection<int, Category> */
    public function getCategories(): Collection { return $this->categories; }

    /** @return Collection<int, Event> */
    public function getEvents(): Collection { return $this->events; }

    // UserInterface
    public function getUserIdentifier(): string { return $this->userHandle; }
    public function getRoles(): array { return ['ROLE_USER']; }
    public function getPassword(): ?string { return null; }
    public function eraseCredentials(): void {}
}
