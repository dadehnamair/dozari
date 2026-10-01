/**
 * Solar Hijri calendar helpers for display only (rule 3: stored years are already Solar Hijri integers).
 * The mascot and avatars take the mood of the current Persian month (D66).
 */

export interface JalaliDate {
  year: number;
  month: number;
  day: number;
}

const CUMULATIVE_DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334] as const;

/** Gregorian y/m/d (month 1..12) to Solar Hijri. */
export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  let jy = gy > 1600 ? 979 : 0;
  const g = gy > 1600 ? gy - 1600 : gy - 621;
  const g2 = gm > 2 ? g + 1 : g;
  let days = 365 * g + Math.floor((g2 + 3) / 4) - Math.floor((g2 + 99) / 100) + Math.floor((g2 + 399) / 400) - 80 + gd + (CUMULATIVE_DAYS[gm - 1] ?? 0);
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const month = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const day = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { year: jy, month, day };
}

/** Iran has had a fixed UTC+03:30 offset since DST was abolished in 2022. */
const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60_000;

/** The Solar Hijri date in Tehran for an epoch-ms instant. */
export function jalaliDateInTehran(epochMs: number): JalaliDate {
  const d = new Date(epochMs + TEHRAN_OFFSET_MS);
  return gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export type SolarMonth = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** Month 1 (Farvardin) .. 12 (Esfand) at the given instant, Tehran time. */
export function solarMonthOf(epochMs: number): SolarMonth {
  return jalaliDateInTehran(epochMs).month as SolarMonth;
}

/** Stable keys; the Persian names and moods live in the app's `fa.ts`. */
export const SOLAR_MONTH_KEYS = [
  'farvardin', 'ordibehesht', 'khordad', 'tir', 'mordad', 'shahrivar',
  'mehr', 'aban', 'azar', 'dey', 'bahman', 'esfand',
] as const;
export type SolarMonthKey = (typeof SOLAR_MONTH_KEYS)[number];

export function solarMonthKey(month: number): SolarMonthKey {
  return SOLAR_MONTH_KEYS[Math.min(11, Math.max(0, Math.trunc(month) - 1))] as SolarMonthKey;
}
