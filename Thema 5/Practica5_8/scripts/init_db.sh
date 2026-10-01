#!/usr/bin/env bash
# Застосовує db/schema.sql до бази з DATABASE_URL (.env у корені проєкту).
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
: "${DATABASE_URL:?Змінну DATABASE_URL не задано (скопіюйте .env.example у .env)}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
echo "Схему застосовано."
