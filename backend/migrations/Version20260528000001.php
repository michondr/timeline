<?php

declare(strict_types=1);

namespace App\Migrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260528000001 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'TickTick habits integration: habit_sync, habit, habit_log tables';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE habit_sync (
                id              UUID        NOT NULL DEFAULT gen_random_uuid(),
                user_id         UUID        NOT NULL,
                session_token   TEXT        DEFAULT NULL,
                last_run_at     TIMESTAMPTZ DEFAULT NULL,
                last_run_status VARCHAR(16) DEFAULT NULL,
                last_run_error  TEXT        DEFAULT NULL,
                PRIMARY KEY (id),
                UNIQUE (user_id),
                FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
            )
        SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE habit (
                id          UUID        NOT NULL DEFAULT gen_random_uuid(),
                user_id     UUID        NOT NULL,
                ticktick_id VARCHAR(64) NOT NULL,
                name        VARCHAR(255) NOT NULL,
                color       VARCHAR(7)  NOT NULL DEFAULT '#ff9f0a',
                start_date  DATE        DEFAULT NULL,
                PRIMARY KEY (id),
                UNIQUE (user_id, ticktick_id),
                FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
            )
        SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE habit_log (
                id       UUID       NOT NULL DEFAULT gen_random_uuid(),
                habit_id UUID       NOT NULL,
                log_date DATE       NOT NULL,
                status   VARCHAR(8) NOT NULL,
                PRIMARY KEY (id),
                UNIQUE (habit_id, log_date),
                FOREIGN KEY (habit_id) REFERENCES habit(id) ON DELETE CASCADE
            )
        SQL);

        $this->addSql('CREATE INDEX idx_habit_log_date ON habit_log (habit_id, log_date)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE habit_log');
        $this->addSql('DROP TABLE habit');
        $this->addSql('DROP TABLE habit_sync');
    }
}
