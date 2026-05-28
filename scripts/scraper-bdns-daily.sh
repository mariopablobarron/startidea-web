#!/usr/bin/env bash
# scraper-bdns-daily.sh
#
# Ejecuta el scraper BDNS contra la web de Startidea.
# Instalar en VPS: /usr/local/bin/scraper-bdns-daily.sh
# Cron sugerido (06:30 UTC todos los días laborables):
#   30 6 * * 1-5 /usr/local/bin/scraper-bdns-daily.sh >> /var/log/startidea-scraper-bdns.log 2>&1
#
# Variables de entorno necesarias (en container Coolify):
#   ADMIN_TOKEN  — valor en startidea-web env vars

set -euo pipefail

CONTAINER_NAME="${CONTAINER_NAME:-startidea-web}"
WEB_URL="${WEB_URL:-https://startidea.es}"
LOGPFX="[scraper-bdns $(date '+%Y-%m-%d %H:%M:%S')]"

# Obtener ADMIN_TOKEN desde el container Docker
ADMIN_TOKEN="$(docker exec "${CONTAINER_NAME}" printenv ADMIN_TOKEN 2>/dev/null || echo '')"
if [ -z "${ADMIN_TOKEN}" ]; then
  echo "${LOGPFX} ERROR: No se pudo obtener ADMIN_TOKEN del container '${CONTAINER_NAME}'" >&2
  exit 1
fi

echo "${LOGPFX} Iniciando scraper BDNS…"

RESPONSE=$(curl -fsSL \
  --max-time 60 \
  --retry 2 \
  --retry-delay 5 \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-admin-token: ${ADMIN_TOKEN}" \
  -d '{}' \
  "${WEB_URL}/api/admin/scraper-bdns" || echo '{"ok":false,"error":"curl_failed"}')

echo "${LOGPFX} Respuesta: ${RESPONSE}"

# Extraer inserted con jq si está disponible
if command -v jq &>/dev/null; then
  INSERTED=$(echo "${RESPONSE}" | jq -r '.inserted // 0')
  FETCHED=$(echo "${RESPONSE}" | jq -r '.fetched // 0')
  ERRORS=$(echo "${RESPONSE}" | jq -r '.errors | length // 0')
  echo "${LOGPFX} Resultados: fetched=${FETCHED} inserted=${INSERTED} errors=${ERRORS}"
fi

echo "${LOGPFX} Fin."
