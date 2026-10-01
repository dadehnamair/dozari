import { describe, expect, it } from 'vitest';
import { formatJalaliYear, formatShortJalaliYear } from '../jalali-year.js';

describe('jalali year formatting', () => {
  it('never inserts a thousands separator, in any runtime', () => {
    expect(formatJalaliYear(1403)).toBe('۱۴۰۳');
    expect(formatShortJalaliYear(1400)).toBe('۱۴۰۰');
  });
  it('shortens 1300s years to two digits', () => {
    expect(formatShortJalaliYear(1375)).toBe('۷۵');
    expect(formatShortJalaliYear(1399)).toBe('۹۹');
  });
});
