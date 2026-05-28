<?php

declare(strict_types=1);

namespace App\Migrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260528000002 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Widen habit.color to 32 chars to accommodate rgba() values from TickTick';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE habit ALTER COLUMN color TYPE VARCHAR(32)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE habit ALTER COLUMN color TYPE VARCHAR(7)');
    }
}
