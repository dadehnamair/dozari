import { BIRTH_YEAR_MIN, isValidJalaliDate } from '@dozari/shared';

/** Persian and Arabic-Indic digits typed on a phone keyboard → ASCII, then a whole number or null. */
export function wholeNumber(text: string): number | null {
  const ascii = text.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  return /^\d{1,4}$/.test(ascii.trim()) ? Number(ascii.trim()) : null;
}

/** The typed year / month / day as a birth date, or null while any part is missing or not a number. */
export function birthFromText(year: string, month: string, day: string): { year: number; month: number; day: number } | null {
  const y = wholeNumber(year);
  const m = wholeNumber(month);
  const d = wholeNumber(day);
  return y !== null && m !== null && d !== null ? { year: y, month: m, day: d } : null;
}

/** Years to pick from, newest first: the youngest allowed age down to the oldest accepted year. */
export function birthYearOptions(currentYear: number, minAge: number): number[] {
  const out: number[] = [];
  for (let y = currentYear - minAge; y >= BIRTH_YEAR_MIN; y--) out.push(y);
  return out;
}

/** Days offered for a month (31 / 30, and Esfand's 29 or 30 by leap year; 31 while the year is still unpicked). */
export function daysInMonth(year: number | null, month: number): number {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return year !== null && isValidJalaliDate(year, 12, 30) ? 30 : 29;
}
