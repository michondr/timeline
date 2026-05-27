.DEFAULT_GOAL := help

COMPOSE := docker compose
DC      := docker
PHP     := $(COMPOSE) exec php
FE      := $(COMPOSE) exec frontend

.PHONY: help init init-backend init-frontend up down restart logs \
        migrate migration-diff migration-status \
        shell shell-fe console cache-clear build clean

# ── Help ──────────────────────────────────────────────────────────────────

help:
	@printf "\033[1mTimeline — available commands\033[0m\n\n"
	@printf "\033[33mSetup (run once):\033[0m\n"
	@printf "  make init              Scaffold backend + frontend, start everything\n\n"
	@printf "\033[33mDaily use:\033[0m\n"
	@printf "  make up                Start all services\n"
	@printf "  make down              Stop all services\n"
	@printf "  make restart           Restart all services\n"
	@printf "  make logs              Follow all logs\n"
	@printf "  make logs-php          Follow PHP + messenger logs only\n"
	@printf "  make logs-fe           Follow frontend logs only\n\n"
	@printf "\033[33mDatabase:\033[0m\n"
	@printf "  make migrate           Run pending migrations\n"
	@printf "  make migration-diff    Generate migration from entity changes\n"
	@printf "  make migration-status  Show migration status\n\n"
	@printf "\033[33mDev:\033[0m\n"
	@printf "  make shell             Open PHP container bash\n"
	@printf "  make shell-fe          Open frontend container sh\n"
	@printf "  make console cmd=...   Run Symfony console command\n"
	@printf "  make build             Rebuild Docker images\n"
	@printf "  make clean             Remove containers + volumes (destructive!)\n"

# ── First-time setup ──────────────────────────────────────────────────────

init: .env init-dirs init-backend init-frontend up
	@printf "\n\033[32m✓ All done!\033[0m\n\n"
	@printf "  \033[36mFrontend\033[0m  http://localhost:5173\n"
	@printf "  \033[36mAPI\033[0m       http://localhost:8080\n"
	@printf "  \033[36mPostgres\033[0m  localhost:5432  (user: timeline)\n\n"
	@printf "Next step: \033[33mmake migrate\033[0m  (after adding your first entity)\n\n"

.env:
	cp .env.example .env
	@printf "\033[33m→ Created .env — edit passwords before continuing\033[0m\n"

init-dirs:
	@mkdir -p backend/public frontend

init-backend:
	@if [ ! -f backend/composer.json ]; then \
		printf "\033[33m→ Scaffolding Symfony in backend/...\033[0m\n"; \
		$(DC) run --rm \
			-v "$(CURDIR)/backend:/app" -w /app \
			composer:2 create-project symfony/skeleton . --no-interaction --prefer-dist; \
		printf "\033[33m→ Installing Symfony packages...\033[0m\n"; \
		$(DC) run --rm \
			-v "$(CURDIR)/backend:/app" -w /app \
			composer:2 require --no-interaction \
				symfony/orm-pack \
				symfony/messenger \
				symfony/scheduler \
				symfony/security-bundle \
				symfony/serializer-pack \
				symfony/validator \
				nelmio/cors-bundle; \
		$(DC) run --rm \
			-v "$(CURDIR)/backend:/app" -w /app \
			composer:2 require --dev --no-interaction \
				symfony/maker-bundle \
				symfony/debug-bundle; \
		printf "\033[32m✓ Symfony scaffolded\033[0m\n"; \
	else \
		printf "backend/composer.json exists — running composer install\n"; \
		$(DC) run --rm -v "$(CURDIR)/backend:/app" -w /app composer:2 install; \
	fi

init-frontend:
	@if [ ! -f frontend/package.json ]; then \
		printf "\033[33m→ Scaffolding React + Vite in frontend/...\033[0m\n"; \
		$(DC) run --rm \
			-v "$(CURDIR):/work" -w /tmp \
			node:20-alpine \
			sh -c 'npm create vite@latest fe_tmp -- --template react-ts && cp -ra fe_tmp/. /work/frontend/ && rm -rf fe_tmp'; \
		$(DC) run --rm \
			-v "$(CURDIR)/frontend:/app" -w /app \
			node:20-alpine \
			sh -c 'npm install && npm install d3 @types/d3 && npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p'; \
		printf "\033[32m✓ Frontend scaffolded\033[0m\n"; \
	else \
		printf "frontend/package.json exists — running npm install\n"; \
		$(DC) run --rm -v "$(CURDIR)/frontend:/app" -w /app node:20-alpine npm install; \
	fi

# ── Services ──────────────────────────────────────────────────────────────

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

build:
	$(COMPOSE) build --no-cache

logs:
	$(COMPOSE) logs -f

logs-php:
	$(COMPOSE) logs -f php messenger

logs-fe:
	$(COMPOSE) logs -f frontend

# ── Database ──────────────────────────────────────────────────────────────

migrate:
	$(PHP) bin/console doctrine:migrations:migrate --no-interaction

migration-diff:
	$(PHP) bin/console doctrine:migrations:diff

migration-status:
	$(PHP) bin/console doctrine:migrations:status

# ── Dev helpers ───────────────────────────────────────────────────────────

shell:
	$(COMPOSE) exec php bash

shell-fe:
	$(COMPOSE) exec frontend sh

console:
	$(PHP) bin/console $(cmd)

cache-clear:
	$(PHP) bin/console cache:clear

# ── Cleanup ───────────────────────────────────────────────────────────────

clean:
	@printf "\033[31mThis will delete all containers and volumes (including the database).\033[0m\n"
	@printf "Press Ctrl-C to abort, Enter to continue: "; read _
	$(COMPOSE) down -v --remove-orphans
