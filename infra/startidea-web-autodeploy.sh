#!/usr/bin/env bash
# /root/startidea-web-autodeploy.sh
# ---------------------------------------------------------------------------
# Auto-deploy por PULL de startidea.es. Inmune al ban de fail2ban en el
# puerto 22 (que tumbaba el deploy por SSH desde GitHub Actions).
#
# Idea: en vez de que GitHub entre al VPS (SSH → baneado), el VPS comprueba
# solo si hay un commit nuevo en main y, si lo hay, lanza el deploy. Cero
# conexiones entrantes.
#
# Cómo detecta "hay algo nuevo": compara el último sha de main (GitHub API)
# con el tag de la imagen del contenedor en marcha — Coolify etiqueta la
# imagen con el sha del commit desplegado (p.ej. ...:b54c170).
#
# Seguridad anti-pileup: /root/deploy-startidea-web.sh ya corre detached y
# tiene flock, así que si el cron dispara durante un build en curso, el
# segundo se salta solo.
#
# INSTALAR (una vez, en el VPS como root):
#   1) crear este archivo en /root/startidea-web-autodeploy.sh
#   2) chmod +x /root/startidea-web-autodeploy.sh
#   3) cron cada 2 min:
#      ( crontab -l 2>/dev/null; echo '*/2 * * * * /root/startidea-web-autodeploy.sh >> /var/log/startidea-autodeploy.log 2>&1' ) | crontab -
# ---------------------------------------------------------------------------
set -uo pipefail

REPO="mariopablobarron/startidea-web"
CONTAINER="startidea-web"

# Último commit de main (GitHub API sin auth: 60 req/h por IP; */2 = 30/h).
latest=$(curl -fsS -m 20 -H 'Accept: application/vnd.github+json' \
  "https://api.github.com/repos/${REPO}/commits/main" \
  | sed -n 's/.*"sha"[[:space:]]*:[[:space:]]*"\([0-9a-f]\{7\}\).*/\1/p' | head -1)

if [ -z "$latest" ]; then
  echo "$(date -u +%FT%TZ) no pude leer el último commit de GitHub — salto este ciclo"
  exit 0
fi

# Sha desplegado = tag de la imagen del contenedor en marcha.
running=$(docker inspect "$CONTAINER" --format '{{.Config.Image}}' 2>/dev/null \
  | sed 's/.*://' | cut -c1-7)

if [ "$latest" = "$running" ]; then
  exit 0   # ya al día, nada que hacer
fi

echo "$(date -u +%FT%TZ) commit nuevo ${latest} (desplegado: ${running:-desconocido}) → lanzando deploy"
bash /root/deploy-startidea-web.sh
