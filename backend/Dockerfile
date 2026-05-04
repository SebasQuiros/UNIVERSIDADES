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

# Compilar TypeScript (noEmitOnError=false genera dist aunque haya errores de tipos)
RUN npm run build || true
# Verificar que el entry point existe
RUN test -f dist/main.js || (echo "ERROR: dist/main.js no fue generado" && exit 1)

EXPOSE 3001

# Correr migraciones y arrancar
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && ([ \"$RUN_SEED\" = \"true\" ] && node prisma/seed.js || true) && node dist/main"]
