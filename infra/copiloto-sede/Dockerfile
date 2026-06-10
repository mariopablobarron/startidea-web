# Imagen oficial de Playwright: trae chromium + dependencias del sistema ya
# instaladas. La versión DEBE coincidir con la de playwright en package.json.
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.mjs ./
COPY drivers ./drivers

ENV PORT=8080
EXPOSE 8080

# Healthcheck simple contra /health
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
