#!/bin/bash
set -e

echo "=== SEQ Deploy Script ==="
echo "Deploy en: $(date)"

# Pull latest
git pull origin main

# Copy env if not exists
if [ ! -f .env ]; then
  cp deploy/.env.production.example .env
  echo "IMPORTANTE: Edita .env con tus valores reales antes de continuar"
  exit 1
fi

# Build y arrancar
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

echo "=== Deploy completado ==="
docker compose -f docker-compose.prod.yml ps
