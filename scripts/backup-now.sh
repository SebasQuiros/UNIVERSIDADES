#!/bin/bash
# ================================================================
#  SJQA GROUP — Backup manual de PostgreSQL
#  Uso: bash scripts/backup-now.sh
# ================================================================
set -e

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/manual"
mkdir -p "$BACKUP_DIR"

echo "📦 Iniciando backup manual..."
docker exec contafacil_db pg_dump \
  -U contafacil \
  -d contafacil \
  --format=custom \
  --compress=9 \
  > "$BACKUP_DIR/contafacil_$DATE.dump"

echo "✅ Backup guardado en: $BACKUP_DIR/contafacil_$DATE.dump"
echo "   Tamaño: $(du -h "$BACKUP_DIR/contafacil_$DATE.dump" | cut -f1)"
