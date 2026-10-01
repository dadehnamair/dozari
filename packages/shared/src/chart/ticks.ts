import type { ChartPoint } from './build.js';

/**
 * Y ticks. Log scale: every power of ten (in rials) inside the domain, falling back to min/max when
 * fewer than two fit. Linear scale: five evenly spaced values from min to max (powers of ten would
 * all pile up at the bottom of a linear axis).
 */
export function yTicks(domain: { minRials: bigint; maxRials: bigint }, scale: 'log' | 'linear' = 'log'): bigint[] {
  if (scale === 'linear') {
    if (domain.minRials === domain.maxRials) return [domain.minRials];
    return [0n, 1n, 2n, 3n, 4n].map((i) => domain.minRials + ((domain.maxRials - domain.minRials) * i) / 4n);
  }
  const ticks: bigint[] = [];
  for (let t = 1n; t <= domain.maxRials; t *= 10n) if (t >= domain.minRials) ticks.push(t);
  if (ticks.length >= 2) return ticks;
  return domain.minRials === domain.maxRials ? [domain.minRials] : [domain.minRials, domain.maxRials];
}

/** X ticks on multiples of `step` years inside the domain; the domain ends if nothing fits. */
export function xTicks(years: { min: number; max: number }, step = 5): number[] {
  const out: number[] = [];
  for (let y = Math.ceil(years.min / step) * step; y <= years.max; y += step) out.push(y);
  return out.length > 0 ? out : years.min === years.max ? [years.min] : [years.min, years.max];
}

/** Split a series into runs that are drawn as one line each (a `breakBefore` point starts a new run). */
export function lineSegments(points: readonly ChartPoint[]): ChartPoint[][] {
  const runs: ChartPoint[][] = [];
  for (const p of points) {
    const last = runs[runs.length - 1];
    if (!last || p.breakBefore) runs.push([p]);
    else last.push(p);
  }
  return runs;
}
