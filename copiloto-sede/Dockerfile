# Copiloto Fase 2 — container Playwright SEPARADO.
# Imagen oficial de Playwright (trae Chromium + todas las deps del SO).
# NUNCA fusionar con la imagen de startidea-web (regla: Playwright fuera del main).
# ⚠️ La versión de esta imagen DEBE coincidir EXACTAMENTE con la de "playwright"
# en package.json (pin exacto, sin ^). Si divergen, Chromium no arranca:
# "Executable doesn't exist at /ms-playwright/chromium_headless_shell-...".
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=8090
ENV NODE_ENV=production
EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8090)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
