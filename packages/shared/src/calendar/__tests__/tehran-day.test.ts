import { describe, expect, it } from 'vitest';
import { tehranDayStart } from '../tehran-day.js';

describe('tehranDayStart', () => {
  it('rolls over at 20:30 UTC (00:00 in Tehran)', () => {
    const midnight = Date.UTC(2026, 9, 1, 20, 30); // 2026-10-02 00:00 Tehran
    expect(tehranDayStart(midnight)).toBe(midnight);
    expect(tehranDayStart(midnight - 1)).toBe(midnight - 24 * 3_600_000);
    expect(tehranDayStart(midnight + 5 * 3_600_000)).toBe(midnight);
  });
});
