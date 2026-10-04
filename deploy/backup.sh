#!/usr/bin/env bash
# Nightly database backup (cron):  0 3 * * *  cd ~/projects/dozari && deploy/backup.sh
# Writes backups/dozari-YYYY-MM-DD.sql.gz, keeps the newest KEEP_DAYS days (default 14) and refuses to keep an empty or broken dump.
# Copy the folder off the machine too (rsync / object storage): a backup on the same disk is not a backup.
set -euo pipefail
cd "$(dirname "$0")/.."
DC="docker compose -f docker-compose.prod.yml --env-file .env.prod"
DIR="${BACKUP_DIR:-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
OUT="$DIR/dozari-$(date +%F).sql.gz"
mkdir -p "$DIR"
$DC exec -T s-dozari-mysql sh -c 'mysqldump -udozari -p"$MYSQL_PASSWORD" --single-transaction --routines dozari' | gzip > "$OUT.tmp"
# A real dump of this schema always contains the users table; anything smaller is a failed run.
if ! gunzip -c "$OUT.tmp" | grep -q 'CREATE TABLE `users`'; then
  rm -f "$OUT.tmp"
  echo "backup failed: the dump has no users table" >&2
  exit 1
fi
mv "$OUT.tmp" "$OUT"
find "$DIR" -name 'dozari-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "backup ok: $OUT ($(du -h "$OUT" | cut -f1))"
