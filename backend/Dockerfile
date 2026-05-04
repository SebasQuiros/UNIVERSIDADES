# ================================================================
#  CONTAFÁCIL SQ — Backend Dockerfile
# ================================================================

# ── Stage: base ──────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++ openssl

# ── Stage: dependencies ──────────────────────────────────────
FROM base AS dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --legacy-peer-deps
# Generar cliente Prisma (usar binario local, no npx que descarga la última versión)
RUN ./node_modules/.bin/prisma generate

# ── Stage: development ───────────────────────────────────────
FROM dependencies AS development
COPY . .
EXPOSE 3001
# El comando se define en docker-compose para incluir migrate + seed
CMD ["npm", "run", "start:dev"]

# ── Stage: build ─────────────────────────────────────────────
FROM dependencies AS build
COPY . .
RUN npm run build

# ── Stage: production ────────────────────────────────────────
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
# Copiar node_modules del stage dependencies (incluye prisma CLI y cliente ya generado)
COPY --from=dependencies /app/node_modules ./node_modules
COPY prisma ./prisma/
COPY --from=build /app/dist ./dist
# Assets estáticos consumidos en runtime (logo SJQA para PDF de facturas, etc.)
COPY --from=build /app/assets ./assets

EXPOSE 3001
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main"]
