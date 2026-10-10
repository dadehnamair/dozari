import { z } from 'zod';
import { BACKUP_MAX_EVERY_HOURS, BACKUP_MAX_KEEP_COUNT, BACKUP_MAX_KEEP_DAYS, BACKUP_TZ_OFFSET_MIN } from '../config/backup.js';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const OFFSET_MS = BACKUP_TZ_OFFSET_MIN * 60_000;

export const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** When a target runs. `weekday` is 0 = Saturday … 6 = Friday (Iranian week); `time` is Iran time. */
export const backupScheduleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('hourly'), everyHours: z.number().int().min(1).max(BACKUP_MAX_EVERY_HOURS) }),
  z.object({ kind: z.literal('daily'), time: timeOfDaySchema }),
  z.object({ kind: z.literal('weekly'), weekday: z.number().int().min(0).max(6), time: timeOfDaySchema }),
]);
export type BackupSchedule = z.infer<typeof backupScheduleSchema>;

/** Old backups go when older than `maxAgeDays` or beyond the newest `maxCount`; null switches that rule off. */
export const backupRetentionSchema = z.object({
  maxAgeDays: z.number().int().min(1).max(BACKUP_MAX_KEEP_DAYS).nullable(),
  maxCount: z.number().int().min(1).max(BACKUP_MAX_KEEP_COUNT).nullable(),
});
export type BackupRetention = z.infer<typeof backupRetentionSchema>;

const parseTime = (t: string): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * The first moment strictly after `after` the schedule fires. Hourly counts from `after` (so it drifts by the run length at most);
 * daily and weekly fire at a fixed Iran-time clock time.
 */
export function nextRunAt(s: BackupSchedule, after: Date): Date {
  if (s.kind === 'hourly') return new Date(after.getTime() + s.everyHours * HOUR_MS);
  const local = after.getTime() + OFFSET_MS; // shifted so UTC getters read Iran wall time
  const dayStart = Math.floor(local / DAY_MS) * DAY_MS;
  const at = parseTime(s.time) * 60_000;
  if (s.kind === 'daily') {
    const cand = dayStart + at;
    return new Date((cand > local ? cand : cand + DAY_MS) - OFFSET_MS);
  }
  // 1970-01-01 (day 0) was a Thursday; Saturday-based index = (days + 5) % 7.
  const dow = (Math.floor(local / DAY_MS) + 5) % 7;
  let days = (s.weekday - dow + 7) % 7;
  let cand = dayStart + days * DAY_MS + at;
  if (cand <= local) cand += 7 * DAY_MS;
  return new Date(cand - OFFSET_MS);
}

/** Due when the next fire after the last scheduled attempt (or the target's creation) has passed. A long outage runs once, not once per missed slot. */
export function isBackupDue(s: BackupSchedule, anchor: Date, now: Date): boolean {
  return nextRunAt(s, anchor).getTime() <= now.getTime();
}

export interface RetentionRun {
  id: string;
  at: number;
  ok: boolean;
}

/**
 * Ids of successful backups the retention rule says to delete. The newest successful backup is never listed,
 * so a short age limit or a dead schedule cannot leave a target with nothing.
 */
export function expiredBackups(runs: readonly RetentionRun[], r: BackupRetention, now: Date): string[] {
  const good = runs.filter((x) => x.ok).sort((a, b) => b.at - a.at);
  const out: string[] = [];
  good.forEach((run, i) => {
    if (i === 0) return;
    const tooOld = r.maxAgeDays !== null && now.getTime() - run.at > r.maxAgeDays * DAY_MS;
    const tooMany = r.maxCount !== null && i >= r.maxCount;
    if (tooOld || tooMany) out.push(run.id);
  });
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Object key for a backup taken at `at`: `<prefix>dozari-YYYYMMDD-HHmmss.sql.gz` (UTC). The prefix is normalised to end with one `/` (or be empty). */
export function backupObjectKey(prefix: string, at: Date): string {
  const p = prefix.trim().replace(/^\/+|\/+$/g, '');
  const stamp = `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}-${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}${pad(at.getUTCSeconds())}`;
  return `${p ? p + '/' : ''}dozari-${stamp}.sql.gz`;
}

/** Weekday names for the admin, in the same 0 = Saturday order as `BackupSchedule.weekday`. */
export const WEEKDAYS_FA = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'] as const;
