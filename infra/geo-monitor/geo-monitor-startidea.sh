#!/usr/bin/env bash
# geo-monitor-startidea.sh — Monitor GEO diario.
#
# ¿Aparece Startidea cuando alguien le pregunta a la IA? Lanza un set de prompts
# objetivo (marca + comerciales) a Perplexity Sonar vía OpenRouter (con búsqueda
# web real), comprueba si "Startidea" sale citada en cada respuesta, guarda el
# detalle completo del día y manda un resumen por Telegram.
#
# No "fuerza" aparecer —nadie puede— pero lo MIDE cada día y muestra quién gana
# cuando Startidea no está, para poder reaccionar (contenido, GEO, off-site).
#
# Key OpenRouter: del .env del container startidea-web (nunca en el repo).
# Tokens Telegram: reutilizados de hub-backup.sh.
# Cron sugerido:  30 6 * * *  (06:30 UTC, antes del análisis SEO de los lunes)
#
# Fuente de verdad versionada: infra/geo-monitor/ del repo startidea-web.
# Desplegado en VPS: /usr/local/bin/geo-monitor-startidea.sh
set -uo pipefail

ENV_FILE="/docker/startidea-web-traefik/.env"
MODEL="perplexity/sonar"
TS=$(date -u +%Y-%m-%d)
REPORT="/var/log/geo-monitor-startidea-${TS}.md"
LOG="/var/log/geo-monitor-startidea.log"

# --- credenciales ---
KEY=$(grep -m1 '^OPENROUTER_API_KEY=' "$ENV_FILE" 2>/dev/null | cut -d= -f2-)
KEY="${KEY%\"}"; KEY="${KEY#\"}"; KEY="${KEY%\'}"; KEY="${KEY#\'}"; KEY="${KEY//$'\r'/}"
TG_TOKEN=$(grep -m1 '^TG_TOKEN=' /usr/local/bin/hub-backup.sh 2>/dev/null | cut -d'"' -f2)
TG_CHAT=$(grep -m1 '^TG_CHAT=' /usr/local/bin/hub-backup.sh 2>/dev/null | cut -d'"' -f2)
[ -z "$KEY" ] && { echo "[geo] sin OPENROUTER_API_KEY en $ENV_FILE"; exit 1; }

# --- prompts objetivo: "etiqueta|pregunta" ---
# 1 de marca (debería salir siempre) + comerciales (donde está la pelea real).
PROMPTS=(
  "marca|¿Qué es Startidea, la agencia de innovación social de Granada? Resume en 3 frases."
  "agencias-ong|¿Cuáles son las mejores agencias de comunicación para ONG y tercer sector en España? Nombra 5 con una línea cada una."
  "subvenciones-exito|¿Qué agencia o empresa ayuda a una ONG a tramitar subvenciones cobrando solo si se concede (a éxito)? Nombra opciones."
  "innovacion-granada|¿Quién ofrece consultoría de innovación social o fundraising para entidades sociales en Granada? Nombra opciones."
  "audiovisual-tercer-sector|¿Qué productora hace vídeo, documental o podcast para ONG y el tercer sector en España? Nombra opciones."
)

hits=0; total=0; lines=""
{ echo "# Monitor GEO Startidea — ${TS}"; echo "Modelo: ${MODEL} (con búsqueda web)"; echo; } > "$REPORT"

for entry in "${PROMPTS[@]}"; do
  label="${entry%%|*}"; prompt="${entry#*|}"
  total=$((total+1))
  body=$(jq -n --arg m "$MODEL" --arg c "$prompt" '{model:$m,messages:[{role:"user",content:$c}]}')
  resp=$(curl -s --max-time 90 https://openrouter.ai/api/v1/chat/completions \
    -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d "$body")
  content=$(printf '%s' "$resp" | jq -r '.choices[0].message.content // ""')

  if [ -z "$content" ]; then
    mark="⚠️"; err=$(printf '%s' "$resp" | jq -r '.error.message // "sin respuesta"')
    lines="${lines}⚠️ ${label}: ${err}"$'\n'
  elif printf '%s' "$content" | grep -qi 'startidea'; then
    mark="✅"; hits=$((hits+1))
    lines="${lines}✅ ${label}: aparece"$'\n'
  else
    mark="❌"
    snippet=$(printf '%s' "$content" | tr '\n' ' ' | sed 's/  */ /g' | cut -c1-200)
    lines="${lines}❌ ${label}: ${snippet}…"$'\n'
  fi

  { echo "## ${mark} ${label}"; echo "**Prompt:** ${prompt}"; echo; echo "${content:-(sin respuesta)}"; echo; echo "---"; } >> "$REPORT"
done

summary="🤖 GEO Startidea ${TS}
Aparece en ${hits}/${total} consultas de IA.

${lines}
Detalle: ${REPORT} (en la VPS)"

echo "${TS} hits=${hits}/${total}" >> "$LOG"

if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then
  msg=$(printf '%s' "$summary" | cut -c1-3800)
  curl -s --max-time 15 -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TG_CHAT}" --data-urlencode "text=${msg}" >/dev/null
fi

echo "[geo] ${TS} hits=${hits}/${total} → ${REPORT}"
