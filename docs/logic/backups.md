# Database backups to S3 (D218)

Admin section **سیستم ← بک‌آپ دیتابیس** (`#/system/backups`, owner only). Scope: the MySQL database only — no uploads, no images, no app files.

## Model

- **Target** (`backup_targets`): an S3-compatible bucket — name, endpoint URL (http/https), region (optional), bucket, key prefix (optional), access key, secret key, active switch, **schedule**, **retention**. Up to `BACKUP_MAX_TARGETS` (50); every target runs independently.
- **Run** (`backup_runs`): one attempt — trigger (`schedule`/`manual`), status (`running`/`ok`/`failed`), object key, size, error text, start/finish time, `deleted_at` + reason (`retention`/`manual`). Deleted runs stay in the history.
- Secret keys are sealed with AES-256-GCM (`apps/server/src/backup/crypto.ts`) using `BACKUP_SECRET_KEY` (falls back to `ADMIN_TOKEN`). They are never returned by the API. If the sealing key changes the target shows «کلید مخفی خوانده نمی‌شود» until the secret is entered again.
- No JSON columns (D63): schedule and retention are flat columns.

## Schedule (pure fns in `packages/shared/src/backup/schedule.ts`)

| kind | fields | fires |
|---|---|---|
| `hourly` | `everyHours` 1–720 | every N hours after the last scheduled start |
| `daily` | `time` HH:MM | every day at that **Iran time** (UTC+3:30, no DST) |
| `weekly` | `weekday` 0=Saturday…6=Friday, `time` | once a week |

The in-process scheduler ticks every `BACKUP_TICK_SECONDS` (60). A target is due when `nextRunAt(schedule, lastScheduledAt ?? createdAt) <= now`; the attempt time is saved *before* the run starts, so a failed run waits for the next slot (no retry loop) and a long outage runs once, not once per missed slot. One run per target at a time (in-process lock); runs left `running` by a dead process are closed as failed at boot. «همین حالا بک‌آپ بگیر» starts a manual run (does not move the schedule).

## Retention («سر چه برنامه‌ای پاک شود»)

Per target, two optional rules, both evaluated after every successful run: delete backups older than `keepDays`; keep only the newest `keepCount`. Either can be empty (= off). **The newest successful backup is never deleted**, whatever the rules say. Failed runs never count. Deleting removes the object from the bucket first, then marks the row deleted; a bucket error leaves the row alone for the next pass.

## Dump

`mysqldump --single-transaction --quick --routines --no-tablespaces --default-character-set=utf8mb4`, piped through gzip straight into the upload (no temp file). Password via `MYSQL_PWD`, never argv. A dump without ``CREATE TABLE `users` `` fails the run (same guard as `deploy/backup.sh`); a failed run removes any partial object. Object key: `<prefix>/dozari-YYYYMMDD-HHmmss.sql.gz` (UTC). The server image needs the client binary (`mariadb-client` in `deploy/Dockerfile.server`); env: `MYSQLDUMP_BIN` (default `mysqldump`), `BACKUP_DUMP_ARGS` (extra flags), `BACKUP_SCHEDULER=off` to disable the clock (e.g. a second replica).

## Admin API (all `system` permission, also GET; audited)

`GET /admin/backups` · `POST /admin/backups` · `PATCH|DELETE /admin/backups/:id` (`?deleteFiles=1` also removes the files) · `POST /admin/backups/test` (writes+removes a probe object) · `POST /admin/backups/:id/run` (202, runs in the background) · `GET /admin/backups/:id/runs` · `DELETE /admin/backups/runs/:runId` · `POST /admin/backups/runs/:runId/download` (10-minute presigned link; POST so a read-only role can never reach it by a plain GET).

## Not built

Restore from the panel (restore is still `deploy/restore-check.sh` / `mysql < dump`), encryption of the dump itself (it relies on the bucket), alerts on a failed run (visible in the list for now), multi-replica locking (run the scheduler on one instance).
