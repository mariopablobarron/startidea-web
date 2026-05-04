# ─── Etapa 1: build ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

ARG PUBLIC_GTM_ID="GTM-N3SR8J"
ARG PUBLIC_GOOGLE_SITE_VERIFICATION=""
ENV PUBLIC_GTM_ID=$PUBLIC_GTM_ID
ENV PUBLIC_GOOGLE_SITE_VERIFICATION=$PUBLIC_GOOGLE_SITE_VERIFICATION

# Build tools para módulos nativos (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Instalamos dependencias primero (mejor caché de capas)
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copiamos el resto y construimos
COPY . .
RUN npm run build

# ─── Etapa 2: runtime ────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Build tools temporales para recompilar better-sqlite3 en runtime
# (se eliminan después con apk del)
RUN apk add --no-cache --virtual .build-deps python3 make g++

# Solo lo necesario para producción
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps && \
    npm cache clean --force && \
    apk del .build-deps

COPY --from=builder /app/dist ./dist

ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4321/ > /dev/null || exit 1

CMD ["node", "./dist/server/entry.mjs"]
