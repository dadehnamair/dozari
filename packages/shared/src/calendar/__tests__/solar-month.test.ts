import { describe, expect, it } from 'vitest';
import { gregorianToJalali, jalaliDateInTehran, solarMonthKey, solarMonthOf } from '../solar-month.js';

describe('gregorianToJalali', () => {
  it.each([
    [2024, 3, 20, 1403, 1, 1],
    [2024, 3, 19, 1402, 12, 29],
    [2026, 3, 21, 1405, 1, 1],
    [2026, 10, 1, 1405, 7, 9],
    [2025, 12, 21, 1404, 9, 30],
    [2025, 12, 22, 1404, 10, 1],
    [2026, 2, 11, 1404, 11, 22],
  ])('%i-%i-%i -> %i/%i/%i', (gy, gm, gd, y, m, d) => {
    expect(gregorianToJalali(gy, gm, gd)).toEqual({ year: y, month: m, day: d });
  });
});

describe('Tehran time', () => {
  it('rolls the day at 00:00 Tehran (UTC+3:30), not at UTC midnight', () => {
    // 2024-03-19T20:29Z is 23:59 in Tehran (29 Esfand); one minute later it is Nowruz.
    expect(jalaliDateInTehran(Date.UTC(2024, 2, 19, 20, 29))).toMatchObject({ month: 12, day: 29 });
    expect(jalaliDateInTehran(Date.UTC(2024, 2, 19, 20, 30))).toMatchObject({ year: 1403, month: 1, day: 1 });
  });

  it('gives the month and its key', () => {
    expect(solarMonthOf(Date.UTC(2026, 9, 1, 12))).toBe(7);
    expect(solarMonthKey(7)).toBe('mehr');
    expect(solarMonthKey(1)).toBe('farvardin');
    expect(solarMonthKey(12)).toBe('esfand');
  });
});
