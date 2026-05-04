#!/bin/sh
# ================================================================
#  SJQA GROUP — Inicialización de TLS con Let's Encrypt
#
#  Este script se ejecuta UNA sola vez en el servidor de producción,
#  después del primer `docker compose -f docker-compose.prod.yml up -d`,
#  para emitir el certificado inicial.
#
#  Uso:
#    1. Configurá el DNS de tu dominio → IP del servidor
#    2. Editá .env.production:  PUBLIC_DOMAIN y CERTBOT_EMAIL
#    3. Arrancá el stack:       docker compose -f docker-compose.prod.yml up -d
#    4. Ejecutá este script:    ./deploy/init-ssl.sh
#    5. Recargá nginx:          docker exec sjqa_nginx nginx -s reload
#
#  Después de esto, el renew es automático (cronjob del container certbot).
# ================================================================

set -e

# Cargar variables desde .env.production
if [ -f .env.production ]; then
    set -a
    . ./.env.production
    set +a
fi

DOMAIN="${PUBLIC_DOMAIN:-}"
EMAIL="${CERTBOT_EMAIL:-}"

if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "tudominio.cr" ]; then
    echo "✗ PUBLIC_DOMAIN no está configurado en .env.production"
    exit 1
fi
if [ -z "$EMAIL" ] || [ "$EMAIL" = "admin@tudominio.cr" ]; then
    echo "✗ CERTBOT_EMAIL no está configurado en .env.production"
    exit 1
fi

echo "→ Emitiendo certificado para: $DOMAIN"
echo "→ Email de aviso:              $EMAIL"

# Pide el certificado al Let's Encrypt usando el desafío HTTP-01.
# El nginx bootstrap ya está sirviendo /.well-known/acme-challenge/
# sobre el puerto 80 (ver nginx.bootstrap.conf.template).
docker run --rm \
    -v sjqa_letsencrypt:/etc/letsencrypt \
    -v sjqa_certbot_www:/var/www/certbot \
    certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --non-interactive \
        -d "$DOMAIN" \
        -d "www.$DOMAIN"

echo "✓ Certificado emitido."

# Cambia al nginx "de producción" que SÍ usa TLS.
echo "→ Rotando nginx a configuración HTTPS..."
docker exec sjqa_nginx sh -c "envsubst '\${PUBLIC_DOMAIN}' < /etc/nginx/templates/nginx.prod.conf.template > /etc/nginx/conf.d/default.conf"
docker exec sjqa_nginx nginx -t
docker exec sjqa_nginx nginx -s reload

echo ""
echo "════════════════════════════════════════════════"
echo "  ✓ HTTPS operativo en https://$DOMAIN"
echo "  ✓ Renovación automática: cada 12 h el container certbot"
echo "    valida y renueva si falta <30 días para expirar."
echo "════════════════════════════════════════════════"
