#!/usr/bin/env bash
# scraper-bdns-daily.sh
#
# Copia de referencia del cron real de la VPS (KVM8):
#   /usr/local/bin/subvenciones-scraper-startidea.sh
#   crontab: 30 8 * * * cron-global-guard <base64 de la ruta>
# Si editas esto, replica el cambio en la VPS (y viceversa).
#
# Paso 1 — scraper BDNS (/api/admin/scraper-bdns): encola convocatorias nuevas
#   como inactivas para revisión en /admin/convocatorias.
# Paso 2 — enriquecimiento (/api/admin/enrich-convocatorias): baja el PDF
#   oficial de BDNS y pre-rellena con IA los campos que la API no da
#   (requisitos, gastos, importes por beneficiario). Endpoint separado a
#   propósito: PDF grande + LLM no caben en el --max-time del scraper.
#
# Auth: ADMIN_TOKEN del container startidea-web → sha256 → header x-admin-token.
# Ligero (curl, sin build). flock evita solapes. NUNCA docker build en cron.

set -euo pipefail

LOG=/var/log/subvenciones-scraper-startidea.log
BASE="https://startidea.es"
LOCK=/var/run/subvenciones-scraper-startidea.lock

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log() { echo "[$(ts)] $*" >> "$LOG"; }

exec 9>"$LOCK"
if ! flock -n 9; then
  log "Otra ejecucion en curso (flock). Salgo."
  exit 0
fi

log "Inicio scraper BDNS -> startidea-web"

# Hash del ADMIN_TOKEN (NO loguea el valor en claro)
ADMIN_HASH=$(docker exec startidea-web sh -c 'echo -n "$ADMIN_TOKEN" | sha256sum | cut -d" " -f1')
if [ -z "$ADMIN_HASH" ]; then
  log "ERROR: ADMIN_TOKEN no leido del container startidea-web"
  exit 1
fi

# Paso 1: scraper (hasta ~72 fetches secuenciales → --max-time 120).
# --retry absorbe blips transitorios (502 de un recreate, corte de red).
RESPONSE=$(curl -sS --max-time 120 --retry 2 --retry-delay 5 -X POST \
  -H "x-admin-token: $ADMIN_HASH" \
  -H "x-cron: 1" \
  -H "Origin: https://startidea.es" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "$BASE/api/admin/scraper-bdns" 2>>"$LOG" || echo '{"ok":false,"error":"curl_failed"}')

log "Respuesta: $RESPONSE"

if ! echo "$RESPONSE" | grep -q '"ok":true'; then
  log "ERROR en respuesta del scraper"
  exit 1
fi
INS=$(echo "$RESPONSE" | grep -o '"inserted":[0-9]*' | cut -d: -f2 || true)
log "Scraper OK (inserted=${INS:-?})"

# Paso 2: enriquecer borradores (activa=0, campos vacios) desde el PDF oficial.
# limit 5/dia: el backlog se drena en dias y el gasto queda en centimos (Haiku).
# --max-time 600: 5 candidatas a ~2 en paralelo con PDFs grandes caben; SIN
# --retry a proposito (reintentar un timeout duplicaria el gasto LLM).
ENRICH=$(curl -sS --max-time 600 -X POST \
  -H "x-admin-token: $ADMIN_HASH" \
  -H "Content-Type: application/json" \
  -d '{"limit":5}' \
  "$BASE/api/admin/enrich-convocatorias" 2>>"$LOG" || echo '{"ok":false,"error":"curl_failed"}')
log "Enrich: $ENRICH"

if ! echo "$ENRICH" | grep -q '"ok":true'; then
  log "ERROR en respuesta del enrich"
  exit 1
fi

exit 0
