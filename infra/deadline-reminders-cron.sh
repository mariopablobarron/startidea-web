#!/bin/bash
# /usr/local/bin/deadline-reminders-cron.sh
#
# Envía recordatorios de plazo (7 días y 2 días) a organizaciones del Copiloto.
# Llama al endpoint admin /api/auto-copiloto/deadline-reminders.
#
# Cron sugerido (VPS, crontab -e):
#   0 9 * * * /usr/local/bin/deadline-reminders-cron.sh >> /var/log/deadline-reminders.log 2>&1
#
# Para instalar en VPS:
#   scp infra/deadline-reminders-cron.sh root@<VPS_IP>:/usr/local/bin/deadline-reminders-cron.sh
#   chmod +x /usr/local/bin/deadline-reminders-cron.sh

set -euo pipefail

LOG_PREFIX="[deadline-reminders] $(date '+%Y-%m-%d %H:%M:%S')"
APP_URL="https://startidea.es"
CONTAINER_NAME="${DOCKER_CONTAINER:-startidea-web}"

echo "$LOG_PREFIX — Iniciando ciclo de recordatorios de plazo"

ADMIN_TOKEN=""
if docker inspect "$CONTAINER_NAME" &>/dev/null; then
  ADMIN_TOKEN=$(docker exec "$CONTAINER_NAME" sh -c 'echo -n "$ADMIN_TOKEN"' 2>/dev/null || true)
fi

if [ -z "$ADMIN_TOKEN" ]; then
  echo "$LOG_PREFIX — ERROR: No se pudo obtener ADMIN_TOKEN del contenedor '$CONTAINER_NAME'"
  exit 1
fi

ADMIN_TOKEN_HASH=$(echo -n "$ADMIN_TOKEN" | sha256sum | awk '{print $1}')

echo "$LOG_PREFIX — Llamando a $APP_URL/api/auto-copiloto/deadline-reminders"

RESPONSE=$(curl -s \
  --max-time 60 \
  --retry 1 \
  --retry-delay 15 \
  -X POST "$APP_URL/api/auto-copiloto/deadline-reminders" \
  -H "x-admin-token: $ADMIN_TOKEN_HASH" \
  -H "content-type: application/json" \
  -w "\n__HTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$RESPONSE" | grep "__HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "__HTTP_STATUS:")

echo "$LOG_PREFIX — HTTP $HTTP_STATUS"
echo "$LOG_PREFIX — Respuesta: $BODY"

if [ "$HTTP_STATUS" != "200" ]; then
  echo "$LOG_PREFIX — ERROR: El endpoint devolvió status $HTTP_STATUS"
  exit 1
fi

echo "$LOG_PREFIX — Ciclo completado"
