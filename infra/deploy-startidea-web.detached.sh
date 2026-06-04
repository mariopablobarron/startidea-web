#!/usr/bin/env bash
# /root/deploy-startidea-web.sh — versión DESACOPLADA + alerta Telegram
# ---------------------------------------------------------------------------
# Por qué: el workflow de GitHub mantenía la sesión SSH abierta los ~4 min del
# build, y a veces se caía con "broken pipe" a mitad (la conexión no aguanta el
# pico de la compilación nativa de better-sqlite3 / contención de recursos en el
# VPS). Reintentar relanzaba el build entero y empeoraba la cosa.
#
# Solución: este script se RELANZA en segundo plano y devuelve el control al
# SSH en <1s. La sesión SSH ya no necesita sobrevivir al build → no más broken
# pipe. Como GitHub solo "dispara" el deploy (verá verde al instante, no el
# resultado real), el propio script te avisa por Telegram del resultado REAL
# (✅ / ❌), reusando el bot que ya usan tus watchdogs de uptime.
#
# CÓMO APLICARLO EN EL VPS (lo haces tú por SSH; yo no puedo, la key del deploy
# está restringida a command="..."):
#   1) Copia de seguridad del script actual:
#        cp /root/deploy-startidea-web.sh /root/deploy-startidea-web.sh.bak
#   2) Edita /root/deploy-startidea-web.sh: deja la CABECERA de abajo (desde el
#        shebang hasta la línea "===== TUS COMANDOS ... =====") y, justo debajo,
#        pega SIN CAMBIOS tus comandos actuales de build + recreate.
#   3) Saca el token del bot que ya usan los watchdogs y ponlo en TG_TOKEN:
#        grep -hoE 'bot[0-9]+:[A-Za-z0-9_-]+' /usr/local/bin/*uptime*.sh | head -1
#        (quita el prefijo "bot"; queda como  8666161869:AAxxxxxxxx)
#   4) Prueba a mano:  /root/deploy-startidea-web.sh
#        → debe volver al prompt al instante; minutos después te llega el
#        Telegram de ✅/❌. El log completo del build queda en:
#        /var/log/startidea-deploy.log
#   5) (Cuando tengas Kapso) cambia el cuerpo de notify() por la llamada a la
#        API de WhatsApp de Kapso y listo — el resto no cambia.
# ---------------------------------------------------------------------------

# --- 1) DESACOPLE: relanzar en segundo plano y devolver el SSH al instante ---
if [ -z "${DEPLOY_BG:-}" ]; then
  DEPLOY_BG=1 setsid "$0" >> /var/log/startidea-deploy.log 2>&1 < /dev/null &
  echo "Deploy lanzado en segundo plano (pid $!). Log: /var/log/startidea-deploy.log"
  exit 0
fi

# --- 2) ALERTA Telegram al terminar (éxito O fallo), reusando el bot watchdog ---
TG_TOKEN="PEGA_AQUI_EL_TOKEN"   # mismo bot que /usr/local/bin/*uptime*.sh (8666161869:AA...)
TG_CHAT="678888"
notify() {
  curl -s -m 10 "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
       --data-urlencode "chat_id=${TG_CHAT}" \
       --data-urlencode "text=$1" >/dev/null 2>&1 || true
}
# Se dispara pase lo que pase (éxito, error, set -e) con el código de salida real.
trap 'rc=$?; if [ "$rc" -eq 0 ]; then \
        notify "✅ startidea.es desplegada OK ($(date -u +%H:%MZ))"; \
      else \
        notify "❌ Deploy startidea.es FALLÓ (rc=$rc) — revisa /var/log/startidea-deploy.log en el VPS"; \
      fi' EXIT

set -euo pipefail
echo "==== Deploy $(date -u +%FT%TZ) ===="

# ===== TUS COMANDOS ACTUALES DE BUILD + RECREATE (pégalos aquí, sin tocar) =====
# Ejemplo de lo que ya hacía tu script (NO lo copies a ciegas, usa el tuyo real):
#   cd /docker/startidea-web-traefik
#   git -C /ruta/al/checkout pull --ff-only
#   docker build ...                    # node:20-alpine + python3 make g++ git
#   docker tag  <imagen>:latest <imagen>:<sha>
#   docker image inspect <imagen>:<sha> >/dev/null   # guarda anti pull-denied
#   docker compose up -d
# ===============================================================================
