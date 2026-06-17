<?php

namespace App\Command;

use App\Entity\User;
use App\Service\ExportService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:export:run', description: 'Write a continuous JSON backup for every user (or one with --user).')]
class ExportTimelineCommand extends Command
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ExportService $export,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('user', 'u', InputOption::VALUE_REQUIRED, 'Export a single user id');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $repo  = $this->em->getRepository(User::class);
        $users = ($id = $input->getOption('user'))
            ? array_filter([$repo->find($id)])
            : $repo->findAll();

        if (!$users) {
            $io->warning('No users to export.');
            return Command::SUCCESS;
        }

        foreach ($users as $user) {
            $result = $this->export->exportUser($user);
            $io->writeln(sprintf(
                '%s %s',
                $result['changed'] ? '<info>changed</info>' : '<comment>no change</comment>',
                $result['file'],
            ));
        }

        return Command::SUCCESS;
    }
}
