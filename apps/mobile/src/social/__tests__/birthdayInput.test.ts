import { describe, expect, it } from 'vitest';
import { birthFromText, wholeNumber } from '../birthdayInput';

describe('birthday input', () => {
  it('reads Persian, Arabic and Latin digits', () => {
    expect(wholeNumber('۱۳۸۰')).toBe(1380);
    expect(wholeNumber('٧')).toBe(7);
    expect(wholeNumber(' 11 ')).toBe(11);
    expect(wholeNumber('')).toBeNull();
    expect(wholeNumber('ab')).toBeNull();
    expect(wholeNumber('12345')).toBeNull();
  });
  it('builds a date only when all three parts are numbers', () => {
    expect(birthFromText('۱۳۸۰', '۷', '۱۱')).toEqual({ year: 1380, month: 7, day: 11 });
    expect(birthFromText('1380', '', '11')).toBeNull();
  });
});
