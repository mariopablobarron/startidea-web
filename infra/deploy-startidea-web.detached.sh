#!/usr/bin/env bash
# /root/deploy-startidea-web.sh — WRAPPER desacoplado + alerta Telegram
# ---------------------------------------------------------------------------
# No toca el script real. La idea:
#   - El script REAL de Mario (build + recreate + healthcheck) se mueve a
#     /root/deploy-startidea-web.real.sh y NO se modifica.
#   - Este wrapper ocupa su sitio (/root/deploy-startidea-web.sh, que es lo que
#     ejecuta la key restringida del deploy) y:
#       1) se relanza en segundo plano (setsid) → la sesión SSH dura <1s, así
#          ya no se cae con "broken pipe" a mitad del build;
#       2) corre el script real en background;
#       3) avisa por Telegram del resultado REAL (✅/❌), reusando el bot que ya
#          usan los watchdogs de uptime (token auto-detectado de *uptime*.sh).
#
# Aplicarlo en el VPS: ver el bloque de comandos en el chat / abajo en COMMANDS.
# Cuando haya Kapso: cambiar el cuerpo de notify() por la API de WhatsApp.
# ---------------------------------------------------------------------------

# 1) Desacople: relanzar en segundo plano y devolver el control al SSH ya.
if [ -z "${DEPLOY_BG:-}" ]; then
  DEPLOY_BG=1 setsid "$0" >> /var/log/startidea-deploy.log 2>&1 < /dev/null &
  echo "Deploy lanzado en segundo plano (pid $!). Log: /var/log/startidea-deploy.log"
  exit 0
fi

# 2) Evitar dos builds a la vez en el VPS.
exec 9>/var/lock/startidea-deploy.lock
flock -n 9 || { echo "Ya hay un deploy en curso — salto."; exit 0; }

# 3) Token del bot de Telegram: auto-detectado de los watchdogs de uptime.
#    (si saliera vacío, pon el token a mano: 8666161869:AAxxxx)
TG_TOKEN="$(grep -hoE 'bot[0-9]+:[A-Za-z0-9_-]+' /usr/local/bin/*uptime*.sh 2>/dev/null | head -1 | sed 's/^bot//')"
TG_CHAT="678888"
notify() {
  [ -n "$TG_TOKEN" ] && curl -s -m 10 "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TG_CHAT}" --data-urlencode "text=$1" >/dev/null 2>&1 || true
}
# Se dispara pase lo que pase, con el código de salida real del build.
trap 'rc=$?; if [ "$rc" -eq 0 ]; then \
        notify "✅ startidea.es desplegada OK ($(date -u +%H:%MZ))"; \
      else \
        notify "❌ Deploy startidea.es FALLÓ (rc=$rc) — mira /var/log/startidea-deploy.log en el VPS"; \
      fi' EXIT

echo "==== Deploy $(date -u +%FT%TZ) ===="
bash /root/deploy-startidea-web.real.sh

# ===========================================================================
# COMMANDS — pegar TAL CUAL en el VPS (estás como root@srv1456258):
# ---------------------------------------------------------------------------
#   cp /root/deploy-startidea-web.sh /root/deploy-startidea-web.sh.bak
#   cp /root/deploy-startidea-web.sh /root/deploy-startidea-web.real.sh
#   # …luego sobrescribir /root/deploy-startidea-web.sh con ESTE wrapper…
#   chmod +x /root/deploy-startidea-web.sh /root/deploy-startidea-web.real.sh
#   /root/deploy-startidea-web.sh          # prueba: vuelve al instante + Telegram
# ===========================================================================
