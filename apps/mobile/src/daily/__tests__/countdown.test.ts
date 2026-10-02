import { describe, expect, it } from 'vitest';
import { formatCountdown } from '../countdown';

describe('formatCountdown', () => {
  it('shows hours, minutes and seconds in Persian digits', () => {
    expect(formatCountdown(5 * 3_600_000 + 12 * 60_000 + 9_000, 0)).toBe('۰۵:۱۲:۰۹');
  });
  it('never goes negative', () => {
    expect(formatCountdown(1000, 5000)).toBe('۰۰:۰۰:۰۰');
  });
});
