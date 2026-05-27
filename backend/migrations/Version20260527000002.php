<?php

declare(strict_types=1);

namespace App\Migrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260527000002 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add auth_key_hash and api_token to user';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE "user" ADD COLUMN auth_key_hash VARCHAR(255) NOT NULL DEFAULT \'\'');
        $this->addSql('ALTER TABLE "user" ADD COLUMN api_token VARCHAR(64) DEFAULT NULL');
        $this->addSql('CREATE UNIQUE INDEX uniq_user_api_token ON "user" (api_token)');
        // Remove the placeholder default so future rows must provide a value
        $this->addSql('ALTER TABLE "user" ALTER COLUMN auth_key_hash DROP DEFAULT');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX uniq_user_api_token');
        $this->addSql('ALTER TABLE "user" DROP COLUMN auth_key_hash');
        $this->addSql('ALTER TABLE "user" DROP COLUMN api_token');
    }
}
