<?php

namespace App\Scheduler;

use App\Entity\AbsIntegration;
use App\Entity\HabitSync;
use App\Entity\User;
use App\Message\ExportTimelineMessage;
use App\Message\SyncAbsMessage;
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

        foreach ($this->em->getRepository(AbsIntegration::class)->findAll() as $i) {
            if (!$i->getUrl() || !$i->getToken()) continue;
            $schedule->add(RecurringMessage::cron('30 * * * *', new SyncAbsMessage($i->getUser()->getId())));
        }

        // Continuous JSON backup: a daily dump per user (writes a tiny
        // _no_change placeholder when nothing changed since the last full dump).
        foreach ($this->em->getRepository(User::class)->findAll() as $user) {
            $schedule->add(RecurringMessage::cron('15 3 * * *', new ExportTimelineMessage($user->getId())));
        }

        return $schedule;
    }
}
