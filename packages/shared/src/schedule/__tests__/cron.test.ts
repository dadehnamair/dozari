import { describe, expect, it } from 'vitest';
import { minCronGapMinutes, nextCronRun, parseCron } from '../cron.js';

const TEHRAN = 210;
// 2026-10-07 12:00 Tehran (a Wednesday) = 08:30 UTC.
const NOW = Date.UTC(2026, 9, 7, 8, 30);
const next = (expr: string, after = NOW) => {
  const spec = parseCron(expr);
  if (!spec) throw new Error('bad cron');
  const t = nextCronRun(spec, after, TEHRAN);
  return t === null ? null : new Date(t + TEHRAN * 60_000).toISOString().slice(0, 16);
};

describe('cron', () => {
  it('rejects malformed expressions', () => {
    for (const bad of ['', '* * * *', '60 * * * *', '* 24 * * *', '*/0 * * * *', 'a * * * *', '5-3 * * * *', '* * 0 * *', '* * * 13 *']) expect(parseCron(bad), bad).toBeNull();
  });

  it('daily at a Tehran wall-clock time', () => {
    expect(next('0 9 * * *')).toBe('2026-10-08T09:00');
    expect(next('30 12 * * *')).toBe('2026-10-07T12:30');
  });

  it('is strictly after the given instant', () => {
    expect(next('30 12 * * *', Date.UTC(2026, 9, 7, 9, 0))).toBe('2026-10-08T12:30');
  });

  it('steps, ranges and lists', () => {
    expect(next('*/20 * * * *')).toBe('2026-10-07T12:20');
    expect(next('0 8-10/2 * * *')).toBe('2026-10-08T08:00');
    expect(next('15,45 13 * * *')).toBe('2026-10-07T13:15');
  });

  it('weekday (0 = Sunday, 7 = Sunday) and day-of-month combine like standard cron', () => {
    expect(next('0 6 * * 6')).toBe('2026-10-10T06:00'); // Saturday
    expect(next('0 6 * * 7')).toBe('2026-10-11T06:00'); // Sunday
    expect(next('0 6 15 * 1')).toBe('2026-10-12T06:00'); // the 15th OR a Monday
  });

  it('crosses months and years', () => {
    expect(next('0 0 1 1 *', Date.UTC(2026, 9, 7))).toBe('2027-01-01T00:00');
  });

  it('measures the tightest gap', () => {
    expect(minCronGapMinutes(parseCron('*/5 * * * *')!, NOW, TEHRAN)).toBe(5);
    expect(minCronGapMinutes(parseCron('0 */6 * * *')!, NOW, TEHRAN)).toBe(360);
    expect(minCronGapMinutes(parseCron('0 9,9 * * *')!, NOW, TEHRAN)).toBe(1440);
  });
});
