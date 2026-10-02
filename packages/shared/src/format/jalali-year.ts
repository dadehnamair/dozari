import { toPersianDigits } from './persian-digits.js';

/** Years never get a thousands separator (some runtimes group 4-digit numbers, e.g. Chromium: «۱٬۴۰۰»). */
const persianYear = (year: number): string => toPersianDigits(String(year));

/**
 * Years in this app are always stored and reasoned about as Solar Hijri integers (rule 3 —
 * `1375`, never a Gregorian conversion). These helpers only handle *display* of an
 * already-Hijri year; they never convert Gregorian <-> Jalali.
 */

/** Full 4-digit Persian-digit year, e.g. 1403 -> "۱۴۰۳". */
export function formatJalaliYear(year: number): string {
  return persianYear(year);
}

/**
 * The short, colloquial form used in game copy: "سال ۷۵" for 1300s years (last two digits of the
 * decade), full 4-digit year once we're past 1399 — matches the prototype's `yShort` helper.
 */
export function formatShortJalaliYear(year: number): string {
  return year >= 1400 ? persianYear(year) : persianYear(year - 1300);
}
