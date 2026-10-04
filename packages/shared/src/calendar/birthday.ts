import { gregorianToJalali, jalaliDateInTehran } from './solar-month.js';
import type { JalaliDate } from './solar-month.js';

/**
 * Birth date and the birthday week (docs/logic/profile-and-identity.md, D160). Dates are Solar Hijri integers (rule 3); the week is
 * counted in whole Tehran days. Pure: the server passes `today`, nothing here reads a clock.
 */

/** Solar Hijri → Gregorian (the standard Jalaali algorithm). Month 1..12. */
export function jalaliToGregorian(jy: number, jm: number, jd: number): { year: number; month: number; day: number } {
  const y = jy + 1595;
  let days = -355668 + 365 * y + Math.floor(y / 33) * 8 + Math.floor(((y % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    days -= 1;
    gy += 100 * Math.floor(days / 36524);
    days %= 36524;
    if (days >= 365) days += 1;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 12 && gd > (lengths[gm] as number)) {
    gd -= lengths[gm] as number;
    gm += 1;
  }
  return { year: gy, month: gm + 1, day: gd };
}

/** Whole days since 1970-01-01 of a Solar Hijri date (a day counter, no time zones). */
export function jalaliDayNumber(d: JalaliDate): number {
  const g = jalaliToGregorian(d.year, d.month, d.day);
  return Math.round(Date.UTC(g.year, g.month - 1, g.day) / 86_400_000);
}

/** A real calendar day (Esfand has 30 days only in a leap year). */
export function isValidJalaliDate(year: number, month: number, day: number): boolean {
  if (![year, month, day].every(Number.isInteger) || month < 1 || month > 12 || day < 1 || day > 31 || year < 1) return false;
  if (month <= 6) return true;
  if (month <= 11) return day <= 30;
  if (day <= 29) return true;
  if (day > 30) return false;
  const g = jalaliToGregorian(year, 12, 30);
  const back = gregorianToJalali(g.year, g.month, g.day);
  return back.year === year && back.month === 12 && back.day === 30;
}

/** The oldest birth year accepted. */
export const BIRTH_YEAR_MIN = 1300;

/** Age in whole years on `today`. */
export function ageOn(birth: JalaliDate, today: JalaliDate): number {
  const before = today.month < birth.month || (today.month === birth.month && today.day < birth.day);
  return today.year - birth.year - (before ? 1 : 0);
}

/** A birth date a player may save: a real day, not before the minimum year, and at least `minAge` years old today. */
export function isAcceptableBirth(birth: JalaliDate, today: JalaliDate, minAge: number): boolean {
  return birth.year >= BIRTH_YEAR_MIN && isValidJalaliDate(birth.year, birth.month, birth.day) && ageOn(birth, today) >= minAge;
}

/** The birthday in `year`; 30 Esfand falls on 29 Esfand in a year that has no 30th. */
export function birthdayIn(birth: JalaliDate, year: number): JalaliDate {
  return isValidJalaliDate(year, birth.month, birth.day) ? { year, month: birth.month, day: birth.day } : { year, month: birth.month, day: birth.day - 1 };
}

export interface BirthdayStatus {
  /** Today is inside the week (3 days before .. 3 days after by default). */
  inWeek: boolean;
  /** Today is the birthday itself. */
  isToday: boolean;
  /** Days until the birthday (negative once it has passed); the nearest occurrence. */
  daysUntil: number;
  /** The Solar Hijri year of that occurrence: the key of the once-a-year gift. */
  year: number;
}

/**
 * Where `today` stands against the player's birthday. The week starts `before` days ahead and lasts `length` days
 * (3 before, the day, 3 after = 7). The nearest occurrence of the birthday (last year's, this year's or next year's) decides,
 * so a week that spans the new year works.
 */
export function birthdayStatus(birth: JalaliDate, today: JalaliDate, before = 3, length = 7): BirthdayStatus {
  const now = jalaliDayNumber(today);
  let best: { delta: number; year: number } | null = null;
  for (const year of [today.year - 1, today.year, today.year + 1]) {
    const delta = jalaliDayNumber(birthdayIn(birth, year)) - now;
    if (best === null || Math.abs(delta) < Math.abs(best.delta)) best = { delta, year };
  }
  const { delta, year } = best as { delta: number; year: number };
  return { inWeek: delta <= before && delta > before - length, isToday: delta === 0, daysUntil: delta, year };
}

/** Today's Solar Hijri date in Tehran for an epoch-ms instant (re-exported so callers need one import). */
export const todayInTehran = (epochMs: number): JalaliDate => jalaliDateInTehran(epochMs);

/** Age bands of the admin dashboard (aggregate only, never per player; the minimum age is 10). */
export const AGE_BANDS = [
  { key: '10-17', min: 10, max: 17 },
  { key: '18-24', min: 18, max: 24 },
  { key: '25-34', min: 25, max: 34 },
  { key: '35-44', min: 35, max: 44 },
  { key: '45+', min: 45, max: Infinity },
] as const;

/** How many players fall into each band, from `n` players sharing a birth date; an age below the first band counts in it. */
export function ageBandCounts(groups: readonly { birth: JalaliDate; n: number }[], today: JalaliDate): { key: string; count: number }[] {
  const counts = AGE_BANDS.map((b) => ({ key: b.key as string, count: 0 }));
  for (const g of groups) {
    const age = ageOn(g.birth, today);
    const i = Math.max(0, AGE_BANDS.findIndex((b) => age >= b.min && age <= b.max));
    (counts[i] as { count: number }).count += g.n;
  }
  return counts;
}
