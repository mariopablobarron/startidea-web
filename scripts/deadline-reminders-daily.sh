#!/usr/bin/env bash
# deadline-reminders-daily.sh
#
# Envía recordatorios de plazo a organizaciones del Copiloto Autónomo
# con convocatorias que vencen en 7 o 2 días.
#
# Instalar en VPS: /usr/local/bin/deadline-reminders-daily.sh
# Cron sugerido (09:00 UTC todos los días laborables):
#   0 9 * * 1-5 /usr/local/bin/deadline-reminders-daily.sh >> /var/log/startidea-deadline-reminders.log 2>&1
#
# Variables de entorno necesarias (en container Coolify):
#   ADMIN_TOKEN  — valor en startidea-web env vars

set -euo pipefail

CONTAINER_NAME="${CONTAINER_NAME:-startidea-web}"
WEB_URL="${WEB_URL:-https://startidea.es}"
LOGPFX="[deadline-reminders $(date '+%Y-%m-%d %H:%M:%S')]"

# Obtener ADMIN_TOKEN desde el container Docker
ADMIN_TOKEN="$(docker exec "${CONTAINER_NAME}" printenv ADMIN_TOKEN 2>/dev/null || echo '')"
if [ -z "${ADMIN_TOKEN}" ]; then
  echo "${LOGPFX} ERROR: No se pudo obtener ADMIN_TOKEN del container '${CONTAINER_NAME}'" >&2
  exit 1
fi

echo "${LOGPFX} Enviando recordatorios de plazo…"

RESPONSE=$(curl -fsSL \
  --max-time 30 \
  --retry 2 \
  --retry-delay 5 \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-admin-token: ${ADMIN_TOKEN}" \
  -d '{}' \
  "${WEB_URL}/api/auto-copiloto/deadline-reminders" || echo '{"ok":false,"error":"curl_failed"}')

echo "${LOGPFX} Respuesta: ${RESPONSE}"

if command -v jq &>/dev/null; then
  SENT=$(echo "${RESPONSE}" | jq -r '.sent // 0')
  SKIPPED=$(echo "${RESPONSE}" | jq -r '.skipped // 0')
  echo "${LOGPFX} Resultados: sent=${SENT} skipped=${SKIPPED}"
fi

echo "${LOGPFX} Fin."
