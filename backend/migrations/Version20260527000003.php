<?php

declare(strict_types=1);

namespace App\Migrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260527000003 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Replace email with user_handle on user table';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE "user" DROP COLUMN IF EXISTS email');
        $this->addSql('ALTER TABLE "user" ADD COLUMN user_handle VARCHAR(64) NOT NULL DEFAULT \'\'');
        $this->addSql('CREATE UNIQUE INDEX uniq_user_handle ON "user" (user_handle)');
        $this->addSql('ALTER TABLE "user" ALTER COLUMN user_handle DROP DEFAULT');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX IF EXISTS uniq_user_handle');
        $this->addSql('ALTER TABLE "user" DROP COLUMN IF EXISTS user_handle');
        $this->addSql('ALTER TABLE "user" ADD COLUMN email VARCHAR(255) NOT NULL DEFAULT \'\'');
        $this->addSql('CREATE UNIQUE INDEX uniq_user_email ON "user" (email)');
        $this->addSql('ALTER TABLE "user" ALTER COLUMN email DROP DEFAULT');
    }
}
