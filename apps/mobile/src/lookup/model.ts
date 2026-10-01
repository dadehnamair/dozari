import { formatJalaliYear, rialsToTomanString, toPersianDigits } from '@dozari/shared';
import type { LookupDetail, LookupRange } from '@dozari/shared';

/** «۱۳۷۵» or «۱۳۷۵/۶»; no RN imports so vitest can run this. */
export function dateLabel(m: { year: number; month: number | null }): string {
  return formatJalaliYear(m.year) + (m.month ? `/${toPersianDigits(String(m.month))}` : '');
}

export function priceLabel(rials: string): string {
  return rialsToTomanString(BigInt(rials));
}

/** One line for a product's range, or null when nothing is approved yet. */
export function rangeLine(range: LookupRange | null): string | null {
  if (!range) return null;
  return `${dateLabel(range.first)} تا ${dateLabel(range.last)} · ${priceLabel(range.min.priceRials)} تا ${priceLabel(range.max.priceRials)}`;
}

/** Distinct years with data, oldest first: the year chips on the detail card. */
export function yearsWithData(points: LookupDetail['points']): number[] {
  return [...new Set(points.map((p) => p.year))].sort((a, b) => a - b);
}
