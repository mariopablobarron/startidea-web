#!/bin/bash
# /usr/local/bin/auto-copiloto-cron.sh
#
# Ejecuta el ciclo diario del Copiloto Autónomo de Subvenciones.
# Llama al endpoint admin /api/auto-copiloto/trigger.
#
# Cron sugerido (VPS, crontab -e):
#   30 7 * * * /usr/local/bin/auto-copiloto-cron.sh >> /var/log/auto-copiloto.log 2>&1
#
# El endpoint puede tardar varios minutos (generación IA por perfil × convocatoria).
# --max-time 900 da 15 minutos de margen.
#
# Para instalar en VPS:
#   scp infra/auto-copiloto-cron.sh root@<VPS_IP>:/usr/local/bin/auto-copiloto-cron.sh
#   chmod +x /usr/local/bin/auto-copiloto-cron.sh

set -euo pipefail

LOG_PREFIX="[auto-copiloto] $(date '+%Y-%m-%d %H:%M:%S')"
APP_URL="https://startidea.es"

echo "$LOG_PREFIX — Iniciando ciclo Copiloto Autónomo"

# Obtener el ADMIN_TOKEN del contenedor Docker
# El contenedor se llama startidea-web (ajustar si el nombre es distinto)
CONTAINER_NAME="${DOCKER_CONTAINER:-startidea-web}"

ADMIN_TOKEN=""
if docker inspect "$CONTAINER_NAME" &>/dev/null; then
  ADMIN_TOKEN=$(docker exec "$CONTAINER_NAME" sh -c 'echo -n "$ADMIN_TOKEN"' 2>/dev/null || true)
fi

if [ -z "$ADMIN_TOKEN" ]; then
  echo "$LOG_PREFIX — ERROR: No se pudo obtener ADMIN_TOKEN del contenedor '$CONTAINER_NAME'"
  exit 1
fi

# Calcular sha256 del token (lo que espera el endpoint)
ADMIN_TOKEN_HASH=$(echo -n "$ADMIN_TOKEN" | sha256sum | awk '{print $1}')

# Llamar al endpoint
echo "$LOG_PREFIX — Llamando a $APP_URL/api/auto-copiloto/trigger"

RESPONSE=$(curl -s \
  --max-time 900 \
  --retry 1 \
  --retry-delay 30 \
  -X POST "$APP_URL/api/auto-copiloto/trigger" \
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
