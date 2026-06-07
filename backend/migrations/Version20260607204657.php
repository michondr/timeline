<?php
declare(strict_types=1);
namespace App\Migrations;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;
final class Version20260607204657 extends AbstractMigration
{
    public function getDescription(): string { return 'Add current_time to book'; }
    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE book ADD "current_time" DOUBLE PRECISION DEFAULT NULL');
    }
    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE book DROP "current_time"');
    }
}
