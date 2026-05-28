<?php

namespace App\Entity;

use App\Repository\HabitLogRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: HabitLogRepository::class)]
#[ORM\UniqueConstraint(columns: ['habit_id', 'log_date'])]
class HabitLog
{
    public const STATUS_DONE = 'done';
    public const STATUS_SKIP = 'skip';
    public const STATUS_FAIL = 'fail';

    #[ORM\Id]
    #[ORM\GeneratedValue(strategy: 'CUSTOM')]
    #[ORM\CustomIdGenerator(class: 'doctrine.uuid_generator')]
    #[ORM\Column(type: 'uuid', unique: true)]
    private ?string $id = null;

    #[ORM\ManyToOne(targetEntity: Habit::class, inversedBy: 'logs')]
    #[ORM\JoinColumn(nullable: false)]
    private Habit $habit;

    #[ORM\Column(name: 'log_date', type: 'date_immutable')]
    private \DateTimeImmutable $date;

    /** done | skip | fail */
    #[ORM\Column(length: 8)]
    private string $status;

    public function getId(): ?string { return $this->id; }

    public function getHabit(): Habit { return $this->habit; }
    public function setHabit(Habit $habit): static { $this->habit = $habit; return $this; }

    public function getDate(): \DateTimeImmutable { return $this->date; }
    public function setDate(\DateTimeImmutable $date): static { $this->date = $date; return $this; }

    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): static { $this->status = $status; return $this; }
}
