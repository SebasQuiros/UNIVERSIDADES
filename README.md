# CONTAFÁCIL SQ
## Plataforma SaaS Educativa de Contabilidad y Facturación Electrónica

> **Desarrollado por Sebastián Quirós Arroyo**  
> Derechos de Autor Reservados © 2026

---

## Descripción

CONTAFÁCIL SQ es un sistema de software real y funcional diseñado para que universidades enseñen contabilidad y facturación electrónica costarricense. Cada estudiante opera dentro de su propia empresa contable aislada, con motor contable de doble partida, facturación electrónica con XML Hacienda CR v4.3, y seguimiento académico en tiempo real.

---

## Requisitos

| Herramienta | Versión mínima | Descarga |
|-------------|---------------|---------|
| Docker Desktop | 4.x | https://www.docker.com/products/docker-desktop/ |
| Docker Compose | v2.x | Incluido en Docker Desktop |

**No se requiere** instalar Node.js, PostgreSQL ni ninguna otra dependencia localmente. Todo corre dentro de Docker.

---

## Inicio rápido

### 1. Clonar o descomprimir el proyecto

```bash
cd contafacil-sq
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Los valores por defecto funcionan para desarrollo local. No es necesario cambiar nada para empezar.

### 3. Iniciar el sistema completo

```bash
docker compose up --build
```

**Primera vez:** 5-8 minutos (descarga imágenes, instala dependencias, compila)  
**Siguientes veces:** ~30 segundos

### 4. Verificar que todo funciona

Una vez que veas estas líneas en la terminal, el sistema está listo:

```
contafacil_backend   | 🚀 CONTAFÁCIL SQ Backend → http://0.0.0.0:3001/api/v1
contafacil_frontend  | ▲ Next.js 14 ready on http://0.0.0.0:3000
```

| Servicio | URL |
|---------|-----|
| **Frontend** | http://localhost:3000 |
| **Backend API** | http://localhost:3001/api/v1 |
| **Base de datos** | localhost:5432 |

---

## Migraciones de base de datos

Las migraciones se ejecutan automáticamente al iniciar con `docker compose up`.

Para ejecutarlas manualmente:

```bash
# Dentro del contenedor backend
docker compose exec backend npx prisma migrate deploy

# En desarrollo (crea nueva migración al cambiar el schema)
docker compose exec backend npx prisma migrate dev --name descripcion_del_cambio

# Ver estado de migraciones
docker compose exec backend npx prisma migrate status
```

---

## Seed — Datos iniciales

El seed se ejecuta automáticamente al iniciar. Para ejecutarlo manualmente:

```bash
docker compose exec backend npx prisma db seed
```

### Usuarios creados por el seed

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Super Admin | admin@contafacil.cr | Admin2026! |
| Profesor | profesor@contafacil.cr | Profesor2026! |
| Estudiante 1 | estudiante1@contafacil.cr | Estudiante1-2026! |
| Estudiante 2 | estudiante2@contafacil.cr | Estudiante2-2026! |

---

## Comandos útiles

```bash
# Ver logs en tiempo real
docker compose logs -f

# Ver logs de un servicio específico
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f database

# Reiniciar un servicio
docker compose restart backend

# Abrir Prisma Studio (interfaz visual de la BD)
docker compose exec backend npx prisma studio
# Luego abrir: http://localhost:5555

# Conectar a PostgreSQL directamente
docker compose exec database psql -U contafacil -d contafacil

# Detener el sistema (conserva los datos)
docker compose down

# Reset completo (borra base de datos)
docker compose down -v
docker compose up --build
```

---

## Estructura del proyecto

```
contafacil-sq/
├── docker-compose.yml          Orquestación de servicios
├── .env.example                Variables de entorno (copiar a .env)
├── README.md                   Este archivo
│
├── backend/                    NestJS API
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma       26 modelos — fuente de verdad del esquema
│   │   ├── seed.ts             Datos iniciales
│   │   └── migrations/         Historial de migraciones (generado por Prisma)
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── prisma/             PrismaService global
│       └── modules/            Módulos funcionales (Fase 2+)
│
├── frontend/                   Next.js 14
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   └── src/
│       └── app/                App Router (Fase 6)
│
└── database/
    └── README.md               Referencia al schema y migraciones
```

---

## Arquitectura

```
Navegador (Next.js 14)
    │
    │ /api/* → proxy interno
    ▼
NestJS Backend (puerto 3001)
    │
    │ Prisma ORM
    ▼
PostgreSQL 15 (puerto 5432)
```

---

## Fases de desarrollo

| Fase | Descripción | Estado |
|------|-------------|--------|
| **Fase 1** | Estructura, Docker, Schema Prisma | ✅ Completa |
| **Fase 2** | Auth, Users, Universities, Courses | ⏳ Pendiente |
| **Fase 3** | Motor contable, Journal, Ledger | ⏳ Pendiente |
| **Fase 4** | Facturación, XML, PDF, Inventario | ⏳ Pendiente |
| **Fase 5** | Ejercicios, Tracking, Calificaciones | ⏳ Pendiente |
| **Fase 6** | Frontend completo | ⏳ Pendiente |

---

## OAuth (Google y Microsoft)

La arquitectura soporta OAuth. Para activarlo, agregar en `.env`:

```env
GOOGLE_CLIENT_ID=tu_client_id
GOOGLE_CLIENT_SECRET=tu_client_secret

MICROSOFT_CLIENT_ID=tu_client_id
MICROSOFT_CLIENT_SECRET=tu_client_secret
```

Las credenciales se obtienen en:
- Google: https://console.cloud.google.com/
- Microsoft: https://portal.azure.com/

---

*CONTAFÁCIL SQ · Sistema SaaS Educativo de Contabilidad*  
*Desarrollado por Sebastián Quirós Arroyo — © 2026*
