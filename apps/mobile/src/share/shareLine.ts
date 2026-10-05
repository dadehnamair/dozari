import { compactTomanLabel, formatShortJalaliYear } from '@dozari/shared';
import type { SoloChart } from '@dozari/shared';
import { fa } from '../i18n/fa';

type Group = SoloChart['groups'][number];

/**
 * The line on the share card: «سال ۷۵ با ۱۰۰ تومن می‌شد نان خرید!». It uses the group's rule year when its products have a price then,
 * else the earliest year any of them has, and names the cheapest product of that year. Null when the group has no usable price.
 */
export function shareLine(group: Group): string | null {
  const points = group.items.flatMap((it) => it.points.map((p) => ({ name: it.nameFa, year: p.year, rials: BigInt(p.priceRials) }))).filter((p) => p.rials > 0n);
  if (points.length === 0) return null;
  const ruleYear = group.ruleYear !== undefined && points.some((p) => p.year === group.ruleYear) ? group.ruleYear : null;
  const year = ruleYear ?? Math.min(...points.map((p) => p.year));
  const best = points.filter((p) => p.year === year).reduce((a, b) => (b.rials < a.rials ? b : a));
  return fa.share.line(formatShortJalaliYear(year), compactTomanLabel(best.rials), best.name);
}
