.PHONY: up down build test lint seed seed-load migrate load-test chaos rebuild-feeds deploy-staging rollback backup restore clean

SHELL := /bin/bash

up:
	@echo "Starting Qelem local development environment..."
	docker compose -f docker/compose.yaml up -d --remove-orphans
	@echo "Waiting for MongoDB replica set initialization..."
	@sleep 3
	@echo "Dev environment running: Web: http://localhost:3000 | API: http://localhost:5000 | Mailpit: http://localhost:8025 | MinIO: http://localhost:9001"

down:
	@echo "Stopping Qelem local services..."
	docker compose -f docker/compose.yaml down

build:
	@echo "Building all workspace packages..."
	npm run build

test:
	@echo "Running all unit, integration, and property tests..."
	npm run test

lint:
	@echo "Running code linters and format checks..."
	npm run lint

seed:
	@echo "Seeding database with default dev dataset (1,000 synthetic Ethiopian users)..."
	npm run seed --workspace=server -- --small

seed-load:
	@echo "Seeding load-test dataset (20,000 users, 500k follow edges, 2M posts)..."
	npm run seed:load --workspace=server -- --load

migrate:
	@echo "Executing database migrations..."
	npm run migrate --workspace=server

rebuild-feeds:
	@echo "Executing feed rebuild for all active users..."
	bash scripts/rebuild-feeds.sh

load-test:
	@echo "Running k6 load test suite against local environment..."
	k6 run tests/load/k6-feed-load.js

chaos:
	@echo "Running chaos engineering failure scenarios..."
	bash tests/chaos/run-chaos.sh

deploy-staging:
	@echo "Deploying release to staging environment..."
	bash scripts/deploy.sh staging

rollback:
	@echo "Initiating automated rollback to previous release..."
	bash scripts/rollback.sh staging

backup:
	@echo "Executing MongoDB snapshot and media sync backup..."
	bash scripts/backup.sh

restore:
	@echo "Restoring database from latest verified backup..."
	bash scripts/restore.sh

clean:
	@echo "Cleaning temporary build artifacts and node_modules..."
	rm -rf dist node_modules packages/*/dist server/dist worker/dist web/dist
