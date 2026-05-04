# ================================================================
#  CONTAFÁCIL SQ — Frontend Dockerfile
# ================================================================

# ── Stage: base ──────────────────────────────────────────────
FROM node:25-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ── Stage: dependencies ──────────────────────────────────────
FROM base AS dependencies
COPY package*.json ./
RUN npm install

# ── Stage: development ───────────────────────────────────────
FROM dependencies AS development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── Stage: build ─────────────────────────────────────────────
FROM dependencies AS build
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# ── Stage: production ────────────────────────────────────────
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
