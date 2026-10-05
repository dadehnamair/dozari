import { describe, expect, it } from 'vitest';
import { ageBandCounts, ageOn, birthdayIn, birthdayStatus, isAcceptableBirth, isValidJalaliDate, jalaliDayNumber, jalaliToGregorian } from '../birthday.js';
import { gregorianToJalali } from '../solar-month.js';

describe('Jalali conversion', () => {
  it('round-trips every day over fifty years', () => {
    for (let t = Date.UTC(1990, 0, 1); t < Date.UTC(2040, 0, 1); t += 86_400_000 * 7) {
      const d = new Date(t);
      const j = gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      expect(jalaliToGregorian(j.year, j.month, j.day)).toEqual({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
    }
  });
  it('knows Nowruz', () => {
    expect(jalaliToGregorian(1404, 1, 1)).toEqual({ year: 2025, month: 3, day: 21 });
    expect(jalaliDayNumber({ year: 1404, month: 1, day: 2 }) - jalaliDayNumber({ year: 1404, month: 1, day: 1 })).toBe(1);
  });
});

describe('validity and age', () => {
  it('accepts real days only; 30 Esfand needs a leap year', () => {
    expect(isValidJalaliDate(1375, 6, 31)).toBe(true);
    expect(isValidJalaliDate(1375, 7, 31)).toBe(false);
    expect(isValidJalaliDate(1375, 13, 1)).toBe(false);
    expect(isValidJalaliDate(1403, 12, 30)).toBe(true); // 1403 is leap
    expect(isValidJalaliDate(1404, 12, 30)).toBe(false);
  });
  it('counts whole years and enforces the minimum age', () => {
    const today = { year: 1405, month: 7, day: 11 };
    expect(ageOn({ year: 1395, month: 7, day: 11 }, today)).toBe(10);
    expect(ageOn({ year: 1395, month: 7, day: 12 }, today)).toBe(9);
    expect(isAcceptableBirth({ year: 1395, month: 7, day: 11 }, today, 10)).toBe(true);
    expect(isAcceptableBirth({ year: 1395, month: 7, day: 12 }, today, 10)).toBe(false);
    expect(isAcceptableBirth({ year: 1299, month: 1, day: 1 }, today, 10)).toBe(false);
  });
  it('moves a 30 Esfand birthday to the 29th in a year without a 30th', () => {
    expect(birthdayIn({ year: 1403, month: 12, day: 30 }, 1404)).toEqual({ year: 1404, month: 12, day: 29 });
    expect(birthdayIn({ year: 1403, month: 12, day: 30 }, 1408)).toEqual({ year: 1408, month: 12, day: 30 });
  });
});

describe('birthday week', () => {
  const birth = { year: 1380, month: 7, day: 11 };
  const at = (day: number, month = 7, year = 1405) => birthdayStatus(birth, { year, month, day });
  it('starts 3 days before and lasts 7 days', () => {
    expect(at(7)).toMatchObject({ inWeek: false, daysUntil: 4 });
    expect(at(8)).toMatchObject({ inWeek: true, daysUntil: 3, isToday: false });
    expect(at(11)).toMatchObject({ inWeek: true, isToday: true, daysUntil: 0 });
    expect(at(14)).toMatchObject({ inWeek: true, daysUntil: -3 });
    expect(at(15)).toMatchObject({ inWeek: false, daysUntil: -4 });
  });
  it('works across the new year and keys the gift by the birthday year', () => {
    const esfand = { year: 1380, month: 1, day: 2 };
    const late = birthdayStatus(esfand, { year: 1405, month: 12, day: 29 });
    expect(late).toMatchObject({ inWeek: true, year: 1406 });
    const early = birthdayStatus(esfand, { year: 1406, month: 1, day: 4 });
    expect(early).toMatchObject({ inWeek: true, year: 1406 });
  });
});

describe('age bands', () => {
  const today = { year: 1405, month: 7, day: 12 };
  it('counts players by exact age on the day, edges included', () => {
    const out = ageBandCounts(
      [
        { birth: { year: 1395, month: 7, day: 12 }, n: 2 }, // 10 today
        { birth: { year: 1395, month: 7, day: 13 }, n: 1 }, // 9: below the first band, still counted in it
        { birth: { year: 1387, month: 7, day: 12 }, n: 4 }, // 18
        { birth: { year: 1388, month: 7, day: 13 }, n: 1 }, // 16
        { birth: { year: 1371, month: 1, day: 1 }, n: 3 }, // 34
        { birth: { year: 1370, month: 12, day: 29 }, n: 5 }, // 34 (birthday later this year? no: Esfand is after Mehr, so 34)
        { birth: { year: 1360, month: 1, day: 1 }, n: 7 }, // 45
      ],
      today,
    );
    expect(out).toEqual([{ key: '10-17', count: 4 }, { key: '18-24', count: 4 }, { key: '25-34', count: 8 }, { key: '35-44', count: 0 }, { key: '45+', count: 7 }]);
  });
  it('is all zeros without players', () => {
    expect(ageBandCounts([], today).every((b) => b.count === 0)).toBe(true);
  });
});

