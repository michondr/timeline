<?php

declare(strict_types=1);

namespace App\Migrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260607162928 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add last_progress_at to book';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE book ADD last_progress_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('COMMENT ON COLUMN book.last_progress_at IS \'(DC2Type:datetime_immutable)\'');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE book DROP last_progress_at');
    }
}
