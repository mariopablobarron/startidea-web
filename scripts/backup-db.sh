#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# backup-db.sh — Backup diario de expedientes.db
#
# Instalar en la VPS:
#   scp scripts/backup-db.sh root@VPS:/usr/local/bin/startidea-backup-db.sh
#   chmod +x /usr/local/bin/startidea-backup-db.sh
#
# Añadir al crontab del root (cron 02:00 UTC):
#   0 2 * * * /usr/local/bin/startidea-backup-db.sh >> /var/log/startidea-backup.log 2>&1
#
# Requiere que ADMIN_TOKEN_HASH esté definido (mismo valor que la var de Coolify).
# Si no está disponible, usar DB_PATH directamente.
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

BACKUP_DIR="/data/backups"
DB_PATH="${EXPEDIENTES_DIR:-/data/expedientes}/expedientes.db"
DATE=$(date +%Y%m%d)
KEEP_DAYS=30

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Iniciando backup..."

if [ -f "$DB_PATH" ]; then
  # Copia directa del archivo SQLite (WAL mode: snapshot consistente)
  cp "$DB_PATH" "$BACKUP_DIR/expedientes-${DATE}.db"
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Backup creado: $BACKUP_DIR/expedientes-${DATE}.db"
else
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] ERROR: No se encuentra $DB_PATH"
  exit 1
fi

# Limpiar backups más antiguos de KEEP_DAYS días
find "$BACKUP_DIR" -name "expedientes-*.db" -mtime +${KEEP_DAYS} -delete
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Backups más antiguos de ${KEEP_DAYS} días eliminados."

# Mostrar backups actuales
COUNT=$(find "$BACKUP_DIR" -name "expedientes-*.db" | wc -l)
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Backups disponibles: $COUNT"
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Backup completado OK."
