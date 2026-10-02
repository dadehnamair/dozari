import { describe, expect, it } from 'vitest';
import { blockedText, placeLabel, roundLabel } from '../text';

describe('tournament texts', () => {
  it('names rounds from the end', () => {
    expect(roundLabel(4, 16)).toBe('فینال');
    expect(roundLabel(3, 16)).toBe('نیمه‌نهایی');
    expect(roundLabel(2, 16)).toBe('یک‌چهارم نهایی');
    expect(roundLabel(1, 16)).toBe('دور ۱');
  });
  it('explains why entry is blocked, with the live numbers', () => {
    expect(blockedText('LEVEL', { minLevel: 5, entryCoins: 20 })).toBe('از سطح ۵ می‌توانی ثبت‌نام کنی.');
    expect(blockedText('COINS', { minLevel: 5, entryCoins: 20 })).toBe('برای ورود ۲۰ سکه لازم است.');
    expect(blockedText('FULL', { minLevel: 1, entryCoins: 0 })).toBe('ظرفیت پر شده است.');
    expect(blockedText(null, { minLevel: 1, entryCoins: 0 })).toBeNull();
  });
  it('labels places', () => {
    expect(placeLabel(1)).toBe('قهرمان');
    expect(placeLabel(3)).toBe('مقام سوم');
  });
});
