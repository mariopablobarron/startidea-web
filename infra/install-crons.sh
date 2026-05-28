#!/bin/bash
# ───────────────────────────────────────────────────────────────────
# install-crons.sh — Instalador unificado de crons en la VPS Hostinger.
#
# Despliega TODOS los scripts cron del proyecto a /usr/local/bin/ con
# los permisos correctos y muestra el bloque de crontab sugerido al final.
# Idempotente: re-ejecutarlo solo sobrescribe los scripts (no toca crontab).
#
# Uso (desde la VPS, con el repo clonado):
#   cd /root/web-de-startidea
#   bash infra/install-crons.sh
#
# o desde local (montaje manual):
#   scp infra/install-crons.sh root@VPS:/tmp/install-crons.sh
#   scp infra/*.sh root@VPS:/tmp/infra/
#   ssh root@VPS 'bash /tmp/install-crons.sh /tmp/infra /tmp/scripts'
#
# ───────────────────────────────────────────────────────────────────

set -euo pipefail

INFRA_DIR="${1:-$(dirname "$0")}"
SCRIPTS_DIR="${2:-$(cd "$INFRA_DIR/../scripts" && pwd)}"
BIN_DIR="/usr/local/bin"
LOG_DIR="/var/log"

LOGPFX="[install-crons]"

if [ "$EUID" -ne 0 ]; then
  echo "$LOGPFX ERROR: requiere ejecutarse como root (necesita escribir en $BIN_DIR)" >&2
  exit 1
fi

# ───── Mapeo: archivo origen → nombre destino en /usr/local/bin ─────
declare -A SCRIPTS=(
  ["$INFRA_DIR/auto-copiloto-cron.sh"]="auto-copiloto-cron.sh"
  ["$INFRA_DIR/deadline-reminders-cron.sh"]="deadline-reminders-cron.sh"
  ["$SCRIPTS_DIR/scraper-bdns-daily.sh"]="startidea-scraper-bdns.sh"
  ["$SCRIPTS_DIR/backup-db.sh"]="startidea-backup-db.sh"
)

# ───── Instalación ─────
for SRC in "${!SCRIPTS[@]}"; do
  DST_NAME="${SCRIPTS[$SRC]}"
  DST="$BIN_DIR/$DST_NAME"

  if [ ! -f "$SRC" ]; then
    echo "$LOGPFX ⚠ Falta: $SRC — saltado" >&2
    continue
  fi

  install -m 755 "$SRC" "$DST"
  echo "$LOGPFX ✓ Instalado: $DST"
done

# ───── Verificar dependencias del sistema ─────
echo ""
echo "$LOGPFX Verificando dependencias del sistema…"
for CMD in docker sqlite3 curl jq; do
  if command -v "$CMD" >/dev/null 2>&1; then
    echo "  ✓ $CMD"
  else
    echo "  ⚠ $CMD — instálalo con: apt-get install -y $CMD"
  fi
done

# ───── Mostrar bloque sugerido de crontab ─────
cat <<EOF

───────────────────────────────────────────────────────────────────
${LOGPFX} INSTALACIÓN COMPLETA

Bloque sugerido de crontab (ejecutar: crontab -e):

# ── Startidea Web — crons del Copiloto de Subvenciones ─────────────
# Backup diario seguro de la BD (02:00 UTC, integridad verificada)
0 2 * * *   $BIN_DIR/startidea-backup-db.sh         >> $LOG_DIR/startidea-backup.log 2>&1

# Scraper BDNS diario (05:00 UTC)
0 5 * * *   $BIN_DIR/startidea-scraper-bdns.sh      >> $LOG_DIR/startidea-scraper-bdns.log 2>&1

# Auto-Copiloto: ciclo diario que detecta convocatorias y envía docs (07:30 UTC)
30 7 * * *  $BIN_DIR/auto-copiloto-cron.sh          >> $LOG_DIR/auto-copiloto.log 2>&1

# Recordatorios de plazo a clientes (09:00 UTC, solo días laborables)
0 9 * * 1-5 $BIN_DIR/deadline-reminders-cron.sh     >> $LOG_DIR/startidea-deadline-reminders.log 2>&1

Para aplicar:
  crontab -e
  (pega el bloque, guarda y sale)

Para verificar:
  crontab -l

Para ver logs recientes:
  tail -f $LOG_DIR/auto-copiloto.log
  tail -f $LOG_DIR/startidea-backup.log

───────────────────────────────────────────────────────────────────
EOF
