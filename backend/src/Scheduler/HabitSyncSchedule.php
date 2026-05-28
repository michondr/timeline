<?php

namespace App\Scheduler;

use App\Entity\HabitSync;
use App\Message\SyncTickTickMessage;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Scheduler\Attribute\AsSchedule;
use Symfony\Component\Scheduler\RecurringMessage;
use Symfony\Component\Scheduler\Schedule;
use Symfony\Component\Scheduler\ScheduleProviderInterface;

#[AsSchedule('habit_sync')]
class HabitSyncSchedule implements ScheduleProviderInterface
{
    public function __construct(private readonly EntityManagerInterface $em) {}

    public function getSchedule(): Schedule
    {
        $schedule = new Schedule();

        // Dispatch a sync for each user that has a session token configured
        $syncs = $this->em->getRepository(HabitSync::class)->findAll();
        foreach ($syncs as $sync) {
            if (!$sync->getSessionToken()) {
                continue;
            }
            $userId = $sync->getUser()->getId();
            $schedule->add(RecurringMessage::cron('0 * * * *', new SyncTickTickMessage($userId)));
        }

        return $schedule;
    }
}
