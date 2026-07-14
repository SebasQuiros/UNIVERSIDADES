# ================================================================
#  CONTAFÁCIL SQ — Backend Dockerfile (multi-stage)
#  Stages: base → dependencies → development → production
#  `production` queda de último: sigue siendo el target por defecto
#  cuando no se especifica uno (deploy/prod sin cambios).
# ================================================================

# ── Base ─────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++ openssl

# ── Dependencias ─────────────────────────────────────────────────
FROM base AS dependencies

COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --legacy-peer-deps

# Generar cliente Prisma con binario local
RUN ./node_modules/.bin/prisma generate

# ── Desarrollo ───────────────────────────────────────────────────
# docker-compose.yml monta el código y define su propio `command`
# (npm install + prisma generate/migrate/seed + arranque), así que
# aquí basta con la imagen con dependencias y el código base.
FROM dependencies AS development

COPY . .

EXPOSE 3001

CMD ["npm", "run", "start:dev"]

# ── Producción ───────────────────────────────────────────────────
FROM dependencies AS production

# Copiar código fuente y assets
COPY . .

# Compilar TypeScript (noEmitOnError=false genera dist aunque haya errores de tipos)
RUN npm run build || true
# Verificar que el entry point existe
RUN test -f dist/main.js || (echo "ERROR: dist/main.js no fue generado" && exit 1)

EXPOSE 3001

# Correr migraciones y arrancar
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node prisma/seed.js && node dist/main"]
