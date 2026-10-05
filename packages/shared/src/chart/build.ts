import { CHART_GAP_BREAK_YEARS, CHART_MIN_YEAR, CHART_SERIES_COLORS } from '../config/index.js';
import { formatShortJalaliYear } from '../format/index.js';
import { priceAt } from '../puzzle/price.js';
import type { CatalogPricePoint } from '../puzzle/types.js';

export interface ChartItem {
  productId: string;
  name: string;
  /** Approved points only (see puzzle/types.ts). */
  prices: readonly CatalogPricePoint[];
}

export interface ChartOptions {
  /** Series colours in item order; defaults to the light categorical palette. */
  colors?: readonly string[];
  /** Year the group's rule refers to, if any: drawn as a vertical dashed marker. */
  ruleYear?: number;
  /** First year drawn and the widest gap (in years) a line still crosses; default = `config/chart.ts`, the admin can change both. */
  minYear?: number;
  gapBreakYears?: number;
}

export interface ChartPoint {
  year: number;
  rials: bigint;
  /** True when the line must NOT be joined to the previous point (gap wider than the limit). */
  breakBefore: boolean;
}

export interface ChartSeries {
  productId: string;
  name: string;
  color: string;
  /** One point per year with data, ascending. Never interpolated. */
  points: ChartPoint[];
}

export interface ChartMarker {
  kind: 'rule_year';
  year: number;
  /** e.g. «سال ۷۵» */
  label: string;
}

export interface ChartData {
  /** X domain (Solar Hijri), min..max over all series, never below CHART_MIN_YEAR. Null if no data. */
  years: { min: number; max: number } | null;
  /** Y domain in rials over all plotted points. Null if no data. */
  yDomain: { minRials: bigint; maxRials: bigint } | null;
  series: ChartSeries[];
  markers: ChartMarker[];
}

/**
 * Plain, render-agnostic data for the overlaid price chart (docs/logic/result-chart.md).
 * Months within a year are aggregated by median (`priceAt`); gaps are never interpolated, and a gap
 * wider than CHART_GAP_BREAK_YEARS breaks the line.
 */
export function buildChartData(items: readonly ChartItem[], options: ChartOptions = {}): ChartData {
  const colors = options.colors ?? CHART_SERIES_COLORS.light;

  const series: ChartSeries[] = items.map((item, i) => {
    const years = [...new Set(item.prices.map((p) => p.year))].filter((y) => y >= (options.minYear ?? CHART_MIN_YEAR)).sort((a, b) => a - b);
    const points: ChartPoint[] = [];
    for (const year of years) {
      const rials = priceAt({ id: item.productId, category: '', eraTags: [], prices: item.prices }, year);
      if (rials === null || rials <= 0n) continue;
      const prev = points[points.length - 1];
      points.push({ year, rials, breakBefore: prev !== undefined && year - prev.year > (options.gapBreakYears ?? CHART_GAP_BREAK_YEARS) });
    }
    return { productId: item.productId, name: item.name, color: colors[i % colors.length] as string, points };
  });

  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return { years: null, yDomain: null, series, markers: [] };

  const yearsList = all.map((p) => p.year);
  const years = { min: Math.max(CHART_MIN_YEAR, Math.min(...yearsList)), max: Math.max(...yearsList) };
  let minRials = all[0]!.rials;
  let maxRials = minRials;
  for (const p of all) {
    if (p.rials < minRials) minRials = p.rials;
    if (p.rials > maxRials) maxRials = p.rials;
  }

  const markers: ChartMarker[] = [];
  if (options.ruleYear !== undefined && options.ruleYear >= years.min && options.ruleYear <= years.max) {
    markers.push({ kind: 'rule_year', year: options.ruleYear, label: `سال ${formatShortJalaliYear(options.ruleYear)}` });
  }
  return { years, yDomain: { minRials, maxRials }, series, markers };
}

export type YScale = 'log' | 'linear';

/**
 * Position of a price on the Y axis as 0 (bottom) .. 1 (top). Display-only floating point maths;
 * the prices themselves stay integer rials. A flat domain maps to the middle.
 */
export function normalizeY(rials: bigint, domain: { minRials: bigint; maxRials: bigint }, scale: YScale): number {
  const lo = Number(domain.minRials);
  const hi = Number(domain.maxRials);
  const v = Number(rials);
  if (hi === lo) return 0.5;
  const t = scale === 'log' ? (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)) : (v - lo) / (hi - lo);
  return Math.min(1, Math.max(0, t));
}

/** Position of a year on the X axis as 0 (left) .. 1 (right). A single-year domain maps to the middle. */
export function normalizeX(year: number, years: { min: number; max: number }): number {
  if (years.max === years.min) return 0.5;
  return Math.min(1, Math.max(0, (year - years.min) / (years.max - years.min)));
}
