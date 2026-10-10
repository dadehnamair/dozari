/** Database backups to S3-compatible storage (docs/logic/backups.md). Times of day are Iran time (UTC+3:30, no DST since 2022). */
export const BACKUP_TZ_OFFSET_MIN = 210;
export const BACKUP_MAX_TARGETS = 50;
export const BACKUP_MAX_EVERY_HOURS = 24 * 30;
export const BACKUP_MAX_KEEP_DAYS = 3650;
export const BACKUP_MAX_KEEP_COUNT = 1000;
/** How often the in-process scheduler looks for targets that are due. */
export const BACKUP_TICK_SECONDS = 60;
/** Lifetime of the temporary download link an admin gets for one backup. */
export const BACKUP_DOWNLOAD_LINK_SECONDS = 600;
/** Most runs listed per target in the admin. */
export const BACKUP_RUNS_LIST_LIMIT = 200;
