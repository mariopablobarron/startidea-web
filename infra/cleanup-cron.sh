#!/bin/bash
# /usr/local/bin/cleanup-cron.sh
#
# Housekeeping mensual de la BD:
#  - Elimina perfiles del Copiloto no confirmados >30 días
#  - (futuro: logs viejos, tokens expirados, etc.)
#
# Cron sugerido (1º de cada mes, 03:30 UTC):
#   30 3 1 * * /usr/local/bin/cleanup-cron.sh >> /var/log/startidea-cleanup.log 2>&1
#
# Variables de entorno necesarias:
#   CONTAINER_NAME  — startidea-web (por defecto)
#   WEB_URL         — https://startidea.es (por defecto)
#   ADMIN_TOKEN     — se obtiene del container Docker

set -euo pipefail

CONTAINER_NAME="${CONTAINER_NAME:-startidea-web}"
WEB_URL="${WEB_URL:-https://startidea.es}"
LOGPFX="[cleanup $(date -u '+%Y-%m-%dT%H:%M:%SZ')]"

ADMIN_TOKEN="$(docker exec "${CONTAINER_NAME}" printenv ADMIN_TOKEN 2>/dev/null || echo '')"
if [ -z "${ADMIN_TOKEN}" ]; then
  echo "${LOGPFX} ERROR: No se pudo obtener ADMIN_TOKEN del container '${CONTAINER_NAME}'" >&2
  exit 1
fi

# 1) Preview de lo que se va a borrar (para logs auditables)
echo "${LOGPFX} Preview de cleanup…"
PREVIEW=$(curl -fsSL --max-time 30 \
  -H "x-admin-token: ${ADMIN_TOKEN}" \
  "${WEB_URL}/api/admin/cleanup?days=30" || echo '{"ok":false}')
echo "${LOGPFX} Preview: ${PREVIEW}"

# 2) Ejecutar cleanup
echo "${LOGPFX} Ejecutando cleanup…"
RESULT=$(curl -fsSL --max-time 60 \
  --retry 2 --retry-delay 5 \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-admin-token: ${ADMIN_TOKEN}" \
  "${WEB_URL}/api/admin/cleanup?days=30" || echo '{"ok":false,"error":"curl_failed"}')
echo "${LOGPFX} Resultado: ${RESULT}"

if command -v jq &>/dev/null; then
  DELETED=$(echo "${RESULT}" | jq -r '.deleted.unconfirmed_profiles // 0')
  echo "${LOGPFX} Resumen: perfiles eliminados=${DELETED}"
fi

echo "${LOGPFX} Fin."
