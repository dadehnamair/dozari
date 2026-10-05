import { describe, expect, it } from 'vitest';
import { birthFromText, birthYearOptions, daysInMonth, wholeNumber } from '../birthdayInput';

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
  it('offers years newest first, from the youngest allowed age', () => {
    const years = birthYearOptions(1405, 13);
    expect(years[0]).toBe(1392);
    expect(years[years.length - 1]).toBe(1300);
  });
  it('knows month lengths, with Esfand by leap year', () => {
    expect(daysInMonth(1380, 3)).toBe(31);
    expect(daysInMonth(1380, 8)).toBe(30);
    expect(daysInMonth(1403, 12)).toBe(30);
    expect(daysInMonth(1404, 12)).toBe(29);
    expect(daysInMonth(null, 12)).toBe(29);
  });
});
