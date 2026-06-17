<?php

namespace App\MessageHandler;

use App\Entity\User;
use App\Message\ExportTimelineMessage;
use App\Service\ExportService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
class ExportTimelineHandler
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ExportService $export,
    ) {}

    public function __invoke(ExportTimelineMessage $message): void
    {
        $user = $this->em->getRepository(User::class)->find($message->userId);
        if (!$user) {
            return;
        }

        $this->export->exportUser($user);
    }
}
