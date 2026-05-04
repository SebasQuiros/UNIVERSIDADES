#!/bin/bash
# ================================================================
#  SJQA GROUP — Restaurar backup de PostgreSQL
#  Uso: bash scripts/restore.sh ./backups/manual/contafacil_FECHA.dump
# ================================================================
set -e

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ Uso: bash scripts/restore.sh <archivo.dump>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Archivo no encontrado: $BACKUP_FILE"
  exit 1
fi

echo "⚠️  ADVERTENCIA: Esto sobreescribirá la base de datos actual."
read -p "¿Continuar? (escribe 'SI' para confirmar): " CONFIRM

if [ "$CONFIRM" != "SI" ]; then
  echo "❌ Cancelado."
  exit 1
fi

echo "🔄 Restaurando backup..."
docker exec -i contafacil_db pg_restore \
  -U contafacil \
  -d contafacil \
  --clean \
  --if-exists \
  < "$BACKUP_FILE"

echo "✅ Base de datos restaurada exitosamente."
