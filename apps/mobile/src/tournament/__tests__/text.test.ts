import { describe, expect, it } from 'vitest';
import { blockedText, currentRound, placeLabel, roundLabel, startsInText } from '../text';

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
    expect(blockedText('GEMS', { minLevel: 1, entryCoins: 0, entryGems: 5 })).toBe('برای ورود ۵ الماس لازم است.');
    expect(blockedText('FULL', { minLevel: 1, entryCoins: 0 })).toBe('ظرفیت پر شده است.');
    expect(blockedText(null, { minLevel: 1, entryCoins: 0 })).toBeNull();
  });
  it('labels places', () => {
    expect(placeLabel(1)).toBe('قهرمان');
    expect(placeLabel(3)).toBe('مقام سوم');
  });
  it('shortens a far start to the two largest units', () => {
    const d = 86_400_000;
    expect(startsInText(47 * d + 5 * 3_600_000, 0)).toBe('۱ ماه و ۲ هفته');
    expect(startsInText(3 * d + 5 * 3_600_000, 0)).toBe('۳ روز و ۵ ساعت');
    expect(startsInText(d, 0)).toBe('۱ روز');
    expect(startsInText(5 * 3_600_000 + 12 * 60_000 + 9_000, 0)).toBe('۰۵:۱۲:۰۹');
  });
  it('opens the bracket on the first round that still has a match to play', () => {
    const m = (round: number, status: 'waiting' | 'ready' | 'playing' | 'done' | 'bye') => ({ round, slot: 0, a: null, b: null, winnerId: null, status });
    expect(currentRound([m(1, 'done'), m(1, 'bye'), m(2, 'playing'), m(3, 'waiting')], 3)).toBe(2);
    expect(currentRound([m(1, 'waiting')], 5)).toBe(1);
    expect(currentRound([m(1, 'done'), m(2, 'done')], 2)).toBe(2);
    expect(currentRound([], 4)).toBe(4);
  });
});
