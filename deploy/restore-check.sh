#!/usr/bin/env bash
# Restore drill: loads a backup into a throw-away database inside the running MySQL container, compares row counts of the key
# tables with the live database, then drops the copy. Run it after every change to the backup setup and about once a month.
#   deploy/restore-check.sh [backups/dozari-YYYY-MM-DD.sql.gz]      (default: the newest backup)
set -euo pipefail
cd "$(dirname "$0")/.."
DC="docker compose -f docker-compose.prod.yml --env-file .env.prod"
FILE="${1:-$(ls -1t "${BACKUP_DIR:-backups}"/dozari-*.sql.gz 2>/dev/null | head -n1)}"
[ -n "$FILE" ] && [ -f "$FILE" ] || { echo "no backup file found" >&2; exit 1; }
TMP="dozari_restore_check"
# The app user cannot create databases; the drill uses root.
sql() { $DC exec -T s-dozari-mysql sh -c "mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" $*"; }
cleanup() { sql -e "'DROP DATABASE IF EXISTS $TMP'" >/dev/null 2>&1 || true; }
trap cleanup EXIT
sql -e "'DROP DATABASE IF EXISTS $TMP; CREATE DATABASE $TMP CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'"
gunzip -c "$FILE" | $DC exec -T s-dozari-mysql sh -c "mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" $TMP"
status=0
for t in users coin_ledger products puzzles; do
  restored=$(sql -N -e "'SELECT COUNT(*) FROM $TMP.$t'")
  live=$(sql -N -e "'SELECT COUNT(*) FROM dozari.$t'")
  echo "$t: restored=$restored live=$live"
  # The backup is older than the live data, so it may have fewer rows, never more and never zero while live has rows.
  if [ "$restored" -gt "$live" ] || { [ "$restored" -eq 0 ] && [ "$live" -gt 0 ]; }; then status=1; fi
done
[ "$status" -eq 0 ] && echo "restore drill ok: $FILE" || { echo "restore drill FAILED: $FILE" >&2; exit 1; }
