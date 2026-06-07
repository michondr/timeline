<?php

declare(strict_types=1);

namespace App\Migrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260607000001 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add abs_integration and book tables';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE abs_integration (
            id UUID NOT NULL,
            user_id UUID NOT NULL,
            url VARCHAR(512) DEFAULT NULL,
            token TEXT DEFAULT NULL,
            last_run_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
            last_run_status VARCHAR(16) DEFAULT NULL,
            last_run_error TEXT DEFAULT NULL,
            PRIMARY KEY(id),
            CONSTRAINT fk_abs_integration_user FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE
        )');
        $this->addSql('CREATE UNIQUE INDEX uniq_abs_integration_user ON abs_integration (user_id)');
        $this->addSql('COMMENT ON COLUMN abs_integration.id IS \'(DC2Type:uuid)\'');
        $this->addSql('COMMENT ON COLUMN abs_integration.user_id IS \'(DC2Type:uuid)\'');
        $this->addSql('COMMENT ON COLUMN abs_integration.last_run_at IS \'(DC2Type:datetime_immutable)\'');

        $this->addSql('CREATE TABLE book (
            id UUID NOT NULL,
            user_id UUID NOT NULL,
            abs_item_id VARCHAR(128) NOT NULL,
            title VARCHAR(512) NOT NULL,
            author VARCHAR(512) DEFAULT NULL,
            started_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
            finished_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
            is_finished BOOLEAN NOT NULL DEFAULT FALSE,
            PRIMARY KEY(id),
            CONSTRAINT fk_book_user FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE
        )');
        $this->addSql('CREATE INDEX idx_book_user ON book (user_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_book_user_abs ON book (user_id, abs_item_id)');
        $this->addSql('COMMENT ON COLUMN book.id IS \'(DC2Type:uuid)\'');
        $this->addSql('COMMENT ON COLUMN book.user_id IS \'(DC2Type:uuid)\'');
        $this->addSql('COMMENT ON COLUMN book.started_at IS \'(DC2Type:datetime_immutable)\'');
        $this->addSql('COMMENT ON COLUMN book.finished_at IS \'(DC2Type:datetime_immutable)\'');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE book');
        $this->addSql('DROP TABLE abs_integration');
    }
}
