import { describe, expect, it } from 'vitest';
import { toPersianDigits, formatPersianNumber } from '../persian-digits.js';

describe('toPersianDigits', () => {
  it('replaces every Western digit with its Persian equivalent', () => {
    expect(toPersianDigits('1375')).toBe('۱۳۷۵');
  });

  it('accepts a number directly', () => {
    expect(toPersianDigits(2026)).toBe('۲۰۲۶');
  });

  it('leaves non-digit characters untouched', () => {
    expect(toPersianDigits('DZ-914K')).toBe('DZ-۹۱۴K');
    expect(toPersianDigits('سال 75 بود')).toBe('سال ۷۵ بود');
  });
});

describe('formatPersianNumber', () => {
  it('groups thousands with Persian digits', () => {
    expect(formatPersianNumber(91460)).toBe('۹۱٬۴۶۰');
  });

  it('respects maximumFractionDigits', () => {
    expect(formatPersianNumber(12.345, 1)).toBe('۱۲٫۳');
  });

  it('defaults to zero fraction digits', () => {
    expect(formatPersianNumber(12.9)).toBe('۱۳');
  });
});
