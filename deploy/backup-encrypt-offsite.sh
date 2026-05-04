#!/bin/sh
# ================================================================
#  SJQA GROUP — Cifrado y respaldo offsite del último backup de DB
#
#  Qué hace:
#    1. Toma el .sql.gz más reciente generado por contafacil_backup
#    2. Lo cifra con AES-256 usando una passphrase del .env (BACKUP_KEY)
#    3. Lo sube a Backblaze B2 (~USD 0.005/GB/mes)
#
#  Cómo ejecutar (desde el servidor de producción):
#    chmod +x deploy/backup-encrypt-offsite.sh
#    ./deploy/backup-encrypt-offsite.sh
#
#  Cron sugerido (todos los días 03:30, después del backup nocturno 02:00):
#    30 3 * * * cd /srv/sjqa && ./deploy/backup-encrypt-offsite.sh >> /var/log/sjqa-offsite.log 2>&1
#
#  Restaurar un backup cifrado:
#    gpg --decrypt --batch --passphrase "$BACKUP_KEY" archivo.sql.gz.gpg | gunzip | psql ...
# ================================================================

set -e

# Cargar variables del .env (BACKUP_KEY, B2_*)
if [ -f .env ]; then
    set -a
    . ./.env
    set +a
elif [ -f .env.production ]; then
    set -a
    . ./.env.production
    set +a
fi

# ── Validar configuración ────────────────────────────────────────
if [ -z "${BACKUP_KEY:-}" ]; then
    echo "✗ BACKUP_KEY no configurada en .env. Generala con:"
    echo "    openssl rand -base64 32"
    echo "  y guardala en un PASSWORD MANAGER (no la pierdas — sin ella no podés restaurar)"
    exit 1
fi

if [ -z "${B2_BUCKET:-}" ] || [ -z "${B2_KEY_ID:-}" ] || [ -z "${B2_APP_KEY:-}" ]; then
    echo "✗ Backblaze B2 no configurado. Crea cuenta en https://www.backblaze.com/ y agrega:"
    echo "    B2_BUCKET=sjqa-backups"
    echo "    B2_KEY_ID=..."
    echo "    B2_APP_KEY=..."
    exit 1
fi

# ── 1. Encontrar el backup más reciente ──────────────────────────
LATEST=$(find ./backups/last -name "*.sql.gz" -type f | head -1)
if [ -z "$LATEST" ]; then
    echo "✗ No se encontró un backup en ./backups/last. ¿Está corriendo contafacil_backup?"
    exit 1
fi

echo "→ Backup origen: $LATEST"

# ── 2. Cifrar con GPG simétrico AES-256 ──────────────────────────
ENC_FILE="${LATEST}.gpg"
gpg --batch --yes --quiet \
    --cipher-algo AES256 \
    --symmetric \
    --passphrase "$BACKUP_KEY" \
    --output "$ENC_FILE" \
    "$LATEST"

SIZE=$(du -h "$ENC_FILE" | cut -f1)
echo "→ Cifrado:        $ENC_FILE ($SIZE)"

# ── 3. Subir a Backblaze B2 ──────────────────────────────────────
# Usa b2 CLI. Si no está, lo instalamos automáticamente vía pipx.
if ! command -v b2 >/dev/null 2>&1; then
    echo "→ Instalando b2 CLI..."
    pip3 install --quiet --user b2 || {
        echo "✗ No se pudo instalar b2 CLI. Instalalo manualmente: pip3 install b2"
        exit 1
    }
    export PATH="$PATH:$HOME/.local/bin"
fi

b2 account authorize "$B2_KEY_ID" "$B2_APP_KEY" >/dev/null 2>&1 || \
    b2 authorize-account "$B2_KEY_ID" "$B2_APP_KEY" >/dev/null

REMOTE_NAME="$(date -u +%Y-%m-%d)/$(basename "$ENC_FILE")"
b2 file upload --quiet "$B2_BUCKET" "$ENC_FILE" "$REMOTE_NAME" >/dev/null 2>&1 || \
    b2 upload-file --quiet "$B2_BUCKET" "$ENC_FILE" "$REMOTE_NAME"

echo "→ Subido a B2:    b2://$B2_BUCKET/$REMOTE_NAME"

# ── 4. Limpieza local del .gpg (lo dejamos solo en B2) ───────────
rm -f "$ENC_FILE"

# ── 5. Política de retención remota ──────────────────────────────
# Borra archivos B2 más viejos que 90 días (Backblaze cobra por almacenado).
# Esto es opcional — Backblaze B2 también soporta lifecycle rules en el bucket.
echo "→ Listo."
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Hoy:    $REMOTE_NAME"
echo "  Para restaurar: ver instrucciones al inicio de este script"
echo "════════════════════════════════════════════════════════════"
