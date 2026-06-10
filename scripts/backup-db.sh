#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# backup-db.sh — Backup diario seguro de expedientes.db
#
# Usa sqlite3 .backup, NO cp directo. En modo WAL un `cp` puede
# capturar un snapshot inconsistente (mezcla de páginas + WAL no
# aplicado), corrompiendo el backup. `.backup` adquiere locks
# correctos y produce un archivo válido sin parar la app.
#
# Instalar en la VPS:
#   ./infra/install-crons.sh   (ejecuta este script en la VPS)
# o manualmente:
#   scp scripts/backup-db.sh root@VPS:/usr/local/bin/startidea-backup-db.sh
#   chmod +x /usr/local/bin/startidea-backup-db.sh
#
# Cron (02:00 UTC todos los días):
#   0 2 * * * /usr/local/bin/startidea-backup-db.sh >> /var/log/startidea-backup.log 2>&1
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

CONTAINER_NAME="${CONTAINER_NAME:-startidea-web}"
BACKUP_DIR="${BACKUP_DIR:-/data/backups}"
DB_PATH_IN_CONTAINER="/data/expedientes/expedientes.db"
DATE=$(date +%Y%m%d-%H%M%S)
KEEP_DAYS="${KEEP_DAYS:-30}"
LOGPFX="[backup $(date -u '+%Y-%m-%dT%H:%M:%SZ')]"

mkdir -p "$BACKUP_DIR"

echo "$LOGPFX Iniciando backup desde container '$CONTAINER_NAME'…"

# Verifica que el container esté arriba
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "$LOGPFX ERROR: container '$CONTAINER_NAME' no está corriendo" >&2
  exit 1
fi

# Verifica que la BD exista dentro del container
if ! docker exec "$CONTAINER_NAME" test -f "$DB_PATH_IN_CONTAINER"; then
  echo "$LOGPFX ERROR: no se encuentra $DB_PATH_IN_CONTAINER en el container" >&2
  exit 1
fi

BACKUP_FILE="$BACKUP_DIR/expedientes-${DATE}.db"

# Backup seguro usando sqlite3 .backup dentro del container y luego copia al host
# (esto evita los problemas de WAL inconsistente del `cp` directo)
docker exec "$CONTAINER_NAME" sh -c \
  "sqlite3 '$DB_PATH_IN_CONTAINER' \".backup '/tmp/backup-${DATE}.db'\""

docker cp "$CONTAINER_NAME:/tmp/backup-${DATE}.db" "$BACKUP_FILE"
docker exec "$CONTAINER_NAME" rm -f "/tmp/backup-${DATE}.db"

# Verificar integridad del backup
if sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" | head -1 | grep -q "^ok$"; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "$LOGPFX Backup OK: $BACKUP_FILE ($SIZE)"
else
  echo "$LOGPFX ERROR: backup corrupto. Eliminando." >&2
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Comprimir para ahorrar espacio
gzip -f "$BACKUP_FILE"
echo "$LOGPFX Comprimido: ${BACKUP_FILE}.gz"

# Rotación: eliminar backups más antiguos de $KEEP_DAYS días
find "$BACKUP_DIR" -name "expedientes-*.db.gz" -mtime "+${KEEP_DAYS}" -delete

COUNT=$(find "$BACKUP_DIR" -name "expedientes-*.db.gz" | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
echo "$LOGPFX Backups retenidos: $COUNT (uso total: $TOTAL_SIZE)"
echo "$LOGPFX Fin."
