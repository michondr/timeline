<?php

declare(strict_types=1);

namespace App\Migrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260606000001 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add range_event_id to event for pin-to-range attachment';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE event ADD COLUMN range_event_id UUID DEFAULT NULL');
        $this->addSql('ALTER TABLE event ADD CONSTRAINT fk_event_range_event FOREIGN KEY (range_event_id) REFERENCES event (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX idx_event_range_event ON event (range_event_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX idx_event_range_event');
        $this->addSql('ALTER TABLE event DROP CONSTRAINT fk_event_range_event');
        $this->addSql('ALTER TABLE event DROP COLUMN range_event_id');
    }
}
