<?php

declare(strict_types=1);

namespace App\Migrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260527000001 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Initial schema: user, category, event';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE "user" (
                id                 UUID        NOT NULL DEFAULT gen_random_uuid(),
                email              VARCHAR(255) NOT NULL,
                kdf_salt           VARCHAR(64)  NOT NULL,
                verification_blob  TEXT         NOT NULL,
                birthdate          DATE         NOT NULL,
                passkey_credentials TEXT        DEFAULT NULL,
                PRIMARY KEY (id),
                UNIQUE (email)
            )
        SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE category (
                id          UUID         NOT NULL DEFAULT gen_random_uuid(),
                user_id     UUID         NOT NULL,
                name        TEXT         NOT NULL,
                color       VARCHAR(7)   NOT NULL,
                is_system   BOOLEAN      NOT NULL DEFAULT FALSE,
                system_slug VARCHAR(32)  DEFAULT NULL,
                PRIMARY KEY (id),
                CONSTRAINT fk_category_user FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE
            )
        SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE event (
                id             UUID        NOT NULL DEFAULT gen_random_uuid(),
                user_id        UUID        NOT NULL,
                category_id    UUID        NOT NULL,
                name           TEXT        NOT NULL,
                type           VARCHAR(8)  NOT NULL DEFAULT 'range',
                start_date     DATE        DEFAULT NULL,
                end_date       DATE        DEFAULT NULL,
                notify_for_end BOOLEAN     NOT NULL DEFAULT FALSE,
                note           TEXT        DEFAULT NULL,
                created_at     TIMESTAMP   NOT NULL,
                updated_at     TIMESTAMP   NOT NULL,
                PRIMARY KEY (id),
                CONSTRAINT fk_event_user     FOREIGN KEY (user_id)     REFERENCES "user"    (id) ON DELETE CASCADE,
                CONSTRAINT fk_event_category FOREIGN KEY (category_id) REFERENCES category  (id)
            )
        SQL);

        $this->addSql('CREATE INDEX idx_category_user   ON category (user_id)');
        $this->addSql('CREATE INDEX idx_event_user      ON event    (user_id)');
        $this->addSql('CREATE INDEX idx_event_category  ON event    (category_id)');
        $this->addSql('CREATE INDEX idx_event_start     ON event    (start_date)');
        $this->addSql('CREATE INDEX idx_event_pending   ON event    (user_id, notify_for_end, end_date)');

        // Messenger transport tables (Doctrine transport)
        $this->addSql(<<<'SQL'
            CREATE TABLE messenger_messages (
                id           BIGSERIAL    NOT NULL,
                body         TEXT         NOT NULL,
                headers      TEXT         NOT NULL,
                queue_name   VARCHAR(190) NOT NULL,
                created_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                available_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                delivered_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                PRIMARY KEY (id)
            )
        SQL);
        $this->addSql('CREATE INDEX IDX_messenger_queue     ON messenger_messages (queue_name)');
        $this->addSql('CREATE INDEX IDX_messenger_available ON messenger_messages (available_at)');
        $this->addSql('CREATE INDEX IDX_messenger_delivered ON messenger_messages (delivered_at)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE IF EXISTS event');
        $this->addSql('DROP TABLE IF EXISTS category');
        $this->addSql('DROP TABLE IF EXISTS "user"');
        $this->addSql('DROP TABLE IF EXISTS messenger_messages');
    }
}
