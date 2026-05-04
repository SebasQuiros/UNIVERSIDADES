# ================================================================
#  CONTAFÁCIL SQ — Backend Dockerfile (single-stage, production)
# ================================================================

FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache python3 make g++ openssl

# Instalar dependencias
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --legacy-peer-deps

# Generar cliente Prisma con binario local
RUN ./node_modules/.bin/prisma generate

# Copiar código fuente y assets
COPY . .

# Compilar TypeScript
RUN npm run build

EXPOSE 3001

# Correr migraciones y arrancar
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main"]
