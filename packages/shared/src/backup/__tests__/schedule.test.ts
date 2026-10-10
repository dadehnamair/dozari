import { describe, expect, it } from 'vitest';
import { backupObjectKey, backupScheduleSchema, expiredBackups, isBackupDue, nextRunAt } from '../schedule.js';

// Iran time is UTC+3:30: 03:00 there is 23:30 UTC the day before.
describe('nextRunAt', () => {
  it('hourly adds the interval', () => {
    expect(nextRunAt({ kind: 'hourly', everyHours: 6 }, new Date('2026-01-01T00:00:00Z')).toISOString()).toBe('2026-01-01T06:00:00.000Z');
  });
  it('daily fires at Iran clock time, today if still ahead, else tomorrow', () => {
    const s = { kind: 'daily', time: '03:00' } as const;
    expect(nextRunAt(s, new Date('2026-01-01T12:00:00Z')).toISOString()).toBe('2026-01-01T23:30:00.000Z');
    expect(nextRunAt(s, new Date('2026-01-01T23:30:00Z')).toISOString()).toBe('2026-01-02T23:30:00.000Z');
    expect(nextRunAt(s, new Date('2026-01-01T20:00:00Z')).toISOString()).toBe('2026-01-01T23:30:00.000Z');
  });
  it('weekly lands on the chosen Saturday-based weekday', () => {
    // 2026-01-03 is a Saturday. Weekday 0 = Saturday at 00:00 Iran = Fri 20:30 UTC.
    const s = { kind: 'weekly', weekday: 0, time: '00:00' } as const;
    expect(nextRunAt(s, new Date('2026-01-01T00:00:00Z')).toISOString()).toBe('2026-01-02T20:30:00.000Z');
    expect(nextRunAt(s, new Date('2026-01-02T20:30:00Z')).toISOString()).toBe('2026-01-09T20:30:00.000Z');
    // Friday (6) at 12:00 Iran = 08:30 UTC on 2026-01-02.
    expect(nextRunAt({ kind: 'weekly', weekday: 6, time: '12:00' }, new Date('2026-01-01T00:00:00Z')).toISOString()).toBe('2026-01-02T08:30:00.000Z');
  });
});

describe('isBackupDue', () => {
  it('is due only once the next slot has passed', () => {
    const s = { kind: 'hourly', everyHours: 1 } as const;
    const anchor = new Date('2026-01-01T00:00:00Z');
    expect(isBackupDue(s, anchor, new Date('2026-01-01T00:59:59Z'))).toBe(false);
    expect(isBackupDue(s, anchor, new Date('2026-01-01T01:00:00Z'))).toBe(true);
  });
});

describe('expiredBackups', () => {
  const day = 86_400_000;
  const now = new Date('2026-02-01T00:00:00Z');
  const run = (id: string, daysAgo: number, ok = true) => ({ id, at: now.getTime() - daysAgo * day, ok });
  it('drops runs older than the age limit', () => {
    expect(expiredBackups([run('a', 1), run('b', 10), run('c', 40)], { maxAgeDays: 30, maxCount: null }, now)).toEqual(['c']);
  });
  it('keeps only the newest N', () => {
    expect(expiredBackups([run('a', 1), run('b', 2), run('c', 3)], { maxAgeDays: null, maxCount: 2 }, now)).toEqual(['c']);
  });
  it('never deletes the newest good backup and ignores failed runs', () => {
    expect(expiredBackups([run('a', 100), run('f', 0, false)], { maxAgeDays: 1, maxCount: 1 }, now)).toEqual([]);
  });
  it('does nothing with both rules off', () => {
    expect(expiredBackups([run('a', 999), run('b', 1)], { maxAgeDays: null, maxCount: null }, now)).toEqual([]);
  });
});

describe('backupObjectKey / schema', () => {
  it('normalises the prefix', () => {
    const at = new Date('2026-03-04T05:06:07Z');
    expect(backupObjectKey('/db//', at)).toBe('db/dozari-20260304-050607.sql.gz');
    expect(backupObjectKey('', at)).toBe('dozari-20260304-050607.sql.gz');
  });
  it('rejects a bad time', () => {
    expect(backupScheduleSchema.safeParse({ kind: 'daily', time: '25:00' }).success).toBe(false);
    expect(backupScheduleSchema.safeParse({ kind: 'daily', time: '03:30' }).success).toBe(true);
  });
});
