# Despliegue SJQA GROUP en Producción

## Requisitos del servidor
- Ubuntu 22.04 LTS (o similar)
- Docker + Docker Compose v2
- 8 GB RAM (recomendado para 500 usuarios simultáneos)
- 4 vCPU
- Dominio con DNS A apuntando a la IP del servidor
- Puertos 80 y 443 abiertos en el firewall

---

## Paso 1 — Preparar variables de entorno

```bash
cp .env.production .env
chmod 600 .env
```

Editá `.env` y reemplazá **obligatoriamente**:
- `PUBLIC_DOMAIN`     → tu dominio real (ej. `sjqa.utn.ac.cr`)
- `CORS_ORIGIN`       → `https://sjqa.utn.ac.cr`
- `NEXT_PUBLIC_API_URL` → `https://sjqa.utn.ac.cr`
- `FRONTEND_URL`      → `https://sjqa.utn.ac.cr`
- `CERTBOT_EMAIL`     → correo válido (recibirá avisos de expiración)

Los secretos (`JWT_SECRET`, `REFRESH_SECRET`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`) ya vienen generados criptográficamente. Si sospechás que se filtraron, regeneralos con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Paso 2 — Arrancar el stack

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

En el primer arranque:
- `nginx` detecta que no hay certificado y usa **configuración bootstrap (solo HTTP)** — el sitio ya es accesible en `http://tudominio.cr`.
- `certbot` queda corriendo en standby.
- `backend` aplica migraciones Prisma automáticamente.
- `db-backup` programa respaldos diarios a las 02:00.

Verifica que los 8 contenedores estén `Up`:

```bash
docker compose -f docker-compose.prod.yml ps
```

---

## Paso 3 — Emitir el certificado TLS (una sola vez)

```bash
chmod +x deploy/init-ssl.sh
./deploy/init-ssl.sh
```

Este script:
1. Lee `PUBLIC_DOMAIN` y `CERTBOT_EMAIL` de `.env`.
2. Pide el certificado a Let's Encrypt por desafío HTTP-01.
3. Rota la config de nginx a la versión HTTPS completa.
4. Recarga nginx.

Después de esto, el sitio responde en `https://tudominio.cr` con HSTS y redirect forzado HTTP → HTTPS.

**Renovación:** el contenedor `sjqa_certbot` verifica cada 12 h si hay certificados próximos a expirar y los renueva automáticamente. No requiere intervención manual.

---

## Respaldos de base de datos

- **Ubicación:** `./backups/` en el host (montado al contenedor `sjqa_backup`).
- **Frecuencia:** diaria, 02:00 hora del servidor.
- **Retención:** 30 días + 12 semanas + 12 meses de archivos rotados.
- **Formato:** `.sql.gz` (gzip de `pg_dump`).

### Restaurar un backup

```bash
# Detener backend para evitar conflictos
docker compose -f docker-compose.prod.yml stop backend

# Restaurar (ajustá la fecha del archivo)
gunzip < backups/daily/contafacil-20260423.sql.gz | \
  docker exec -i sjqa_db psql -U contafacil_prod -d contafacil_prod

# Reanudar
docker compose -f docker-compose.prod.yml start backend
```

### Copiar respaldos a otro servidor (recomendado)

El disco local se puede perder. Sincroniza `./backups/` a S3, Backblaze B2, etc. Ejemplo con `rclone` en cron diario:

```cron
30 3 * * * rclone sync /srv/sjqa/backups remote:sjqa-backups --log-file=/var/log/rclone.log
```

---

## Verificaciones post-deploy

```bash
# TLS + HSTS
curl -sI https://tudominio.cr | grep -iE "strict-transport|x-frame|content-security"

# API responde
curl -s https://tudominio.cr/api/v1/onboarding/plans

# Backup generado al menos una vez
ls -la backups/last/
```

---

## Estimado de capacidad

| Servidor (DigitalOcean) | Usuarios simultáneos | Costo/mes |
|--------------------------|----------------------|-----------|
| 4 GB / 2 CPU             | ~100                 | USD 24    |
| 8 GB / 4 CPU             | ~500                 | USD 48    |
| 16 GB / 8 CPU            | ~1000                | USD 96    |

---

## Troubleshooting

**nginx no arranca después de init-ssl.sh**
```bash
docker logs sjqa_nginx --tail 30
docker exec sjqa_nginx nginx -t
```

**Certbot falla con "DNS problem"**
Verificá que el A record de tu dominio apunte a la IP pública del servidor y que el puerto 80 esté abierto:
```bash
dig +short tudominio.cr
```

**Base de datos no arranca**
```bash
docker logs sjqa_db --tail 50
```
Suele ser la primera vez y está inicializando — esperá ~30 segundos.
