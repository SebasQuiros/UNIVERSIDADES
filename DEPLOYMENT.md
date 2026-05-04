# Despliegue en VPS — SJQA GROUP

## Requisitos
- Ubuntu 22.04
- Docker + Docker Compose
- Git
- Puerto 80/443 abierto en el firewall

## Primera vez

```bash
git clone https://github.com/[usuario]/sjqagroup /opt/sjqagroup
cd /opt/sjqagroup
cp .env.example .env
# Editar .env con los valores de producción
docker volume create contafacil_pgdata
docker-compose up --build -d
```

## Actualizaciones manuales

```bash
cd /opt/sjqagroup
git pull origin main
docker-compose up --build -d backend frontend
docker system prune -f
```

## GitHub Secrets necesarios

Configura estos secrets en **Settings → Secrets and variables → Actions** de tu repositorio:

| Secret | Descripción |
|--------|-------------|
| `VPS_HOST` | IP pública del servidor (ej: `203.0.113.42`) |
| `VPS_USER` | Usuario SSH del servidor (ej: `ubuntu`) |
| `VPS_SSH_KEY` | Clave privada SSH (contenido completo del archivo `id_rsa`) |

### Generar clave SSH para el deploy

```bash
# En tu máquina local:
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/sjqagroup_deploy

# Agregar la clave pública al servidor:
ssh-copy-id -i ~/.ssh/sjqagroup_deploy.pub ubuntu@TU_IP_VPS

# El contenido de ~/.ssh/sjqagroup_deploy (clave PRIVADA) va en el secret VPS_SSH_KEY
```

## Variables de entorno en producción

Edita `/opt/sjqagroup/.env` con los siguientes valores:

```env
NODE_ENV=production

# Base de datos
DATABASE_URL=postgresql://sjqa_user:PASSWORD_SEGURA@db:5432/sjqa_db
POSTGRES_DB=sjqa_db
POSTGRES_USER=sjqa_user
POSTGRES_PASSWORD=PASSWORD_SEGURA_AQUI

# JWT — mínimo 64 caracteres aleatorios
JWT_SECRET=GENERA_CON_openssl_rand_-hex_64

# Anthropic (IA)
ANTHROPIC_API_KEY=sk-ant-...  # de console.anthropic.com

# Email (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tucorreo@gmail.com
SMTP_PASS=APP_PASSWORD_GMAIL  # No la contraseña normal, crear en myaccount.google.com/apppasswords

# Frontend
NEXT_PUBLIC_API_URL=https://tu-dominio.com/api
```

### Generar JWT_SECRET seguro

```bash
openssl rand -hex 64
```

## Estructura de directorios en el VPS

```
/opt/sjqagroup/
├── backend/
├── frontend/
├── database/
├── backups/          # Backups automáticos de la BD
├── docker-compose.yml
└── .env
```

## Backups automáticos

El workflow `backup.yml` verifica diariamente a las 2 AM (hora Costa Rica) que exista un backup reciente en `/opt/sjqagroup/backups/`.

Para configurar el backup automático en el servidor:

```bash
# Agregar al crontab del servidor (crontab -e):
0 1 * * * docker exec sjqa_db pg_dump -U sjqa_user sjqa_db | gzip > /opt/sjqagroup/backups/backup-$(date +\%Y\%m\%d).sql.gz
# Retener solo los últimos 7 días:
0 2 * * * find /opt/sjqagroup/backups/ -name "*.sql.gz" -mtime +7 -delete
```

## Verificar el deploy

```bash
# Ver logs de los contenedores:
docker-compose logs -f backend
docker-compose logs -f frontend

# Ver estado de los contenedores:
docker-compose ps

# Reiniciar un servicio:
docker-compose restart backend
```

## Flujo de CI/CD

1. **Push a `develop`** → CI corre tests y build (sin deploy)
2. **Pull Request a `main`** → CI corre tests y build, bloquea el merge si fallan
3. **Push a `main`** (merge aprobado) → CI + Deploy automático al VPS vía SSH
4. **Diariamente a las 2 AM CR** → Verificación automática del backup
