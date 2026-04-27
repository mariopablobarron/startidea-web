# ─── Etapa 1: build ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instalamos dependencias primero (mejor caché de capas)
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copiamos el resto y construimos
COPY . .
RUN npm run build

# ─── Etapa 2: runtime ────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Solo lo necesario para producción
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

COPY --from=builder /app/dist ./dist

ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
