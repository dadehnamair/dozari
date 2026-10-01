import { describe, expect, it } from 'vitest';
import { maskPhone, normalizeIranPhone } from '../normalize.js';

describe('normalizeIranPhone', () => {
  it('accepts the usual spellings and always returns +989…', () => {
    for (const raw of ['09123456789', '9123456789', '+989123456789', '00989123456789', '989123456789', '۰۹۱۲۳۴۵۶۷۸۹', '٠٩١٢٣٤٥٦٧٨٩', ' 0912-345 67 89 ', '(0912) 3456789'])
      expect(normalizeIranPhone(raw)).toBe('+989123456789');
  });
  it('refuses landlines, foreign and malformed numbers', () => {
    for (const raw of ['02112345678', '+14155550123', '0912345678', '091234567890', 'abc', '', '08123456789']) expect(normalizeIranPhone(raw)).toBeNull();
  });
  it('masks the middle', () => {
    expect(maskPhone('+989123456789')).toBe('0912 ••• 6789');
  });
});
