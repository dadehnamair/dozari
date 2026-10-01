import { describe, expect, it } from 'vitest';
import { buildChartData, normalizeX, normalizeY } from '../build.js';
import type { ChartItem } from '../build.js';
import { compactTomanLabel } from '../../format/index.js';

const item = (id: string, pts: Record<number, number>, extra: Record<number, number> = {}): ChartItem => ({
  productId: id,
  name: `کالا ${id}`,
  prices: [
    ...Object.entries(pts).map(([y, r]) => ({ year: Number(y), month: null, priceRials: BigInt(r) })),
    ...Object.entries(extra).map(([y, r]) => ({ year: Number(y), month: 6, priceRials: BigInt(r) })),
  ],
});

describe('buildChartData', () => {
  const items = [
    item('a', { 1370: 100, 1375: 1_000, 1380: 10_000 }),
    item('b', { 1375: 50, 1400: 5_000 }),
  ];

  it('builds ascending per-product series with colours, domains and no interpolation', () => {
    const d = buildChartData(items);
    expect(d.series.map((s) => s.points.map((p) => p.year))).toEqual([[1370, 1375, 1380], [1375, 1400]]);
    expect(d.series[0]!.color).not.toBe(d.series[1]!.color);
    expect(d.years).toEqual({ min: 1370, max: 1400 });
    expect(d.yDomain).toEqual({ minRials: 50n, maxRials: 10_000n });
  });

  it('breaks the line only across gaps wider than the limit', () => {
    const d = buildChartData([item('g', { 1370: 10, 1375: 20, 1381: 30 })]);
    // 1370->1375 is exactly 5 years: joined. 1375->1381 is 6 years: broken.
    expect(d.series[0]!.points.map((p) => p.breakBefore)).toEqual([false, false, true]);
  });

  it('takes the median when several months exist in a year', () => {
    const d = buildChartData([item('m', { 1375: 100 }, { 1375: 300 })]);
    expect(d.series[0]!.points[0]!.rials).toBe(200n);
  });

  it('clamps the domain at 1340 and ignores earlier points', () => {
    const d = buildChartData([item('o', { 1330: 5, 1350: 10 })]);
    expect(d.years).toEqual({ min: 1350, max: 1350 });
    expect(d.series[0]!.points).toHaveLength(1);
  });

  it('adds a rule-year marker only when it falls inside the domain', () => {
    expect(buildChartData(items, { ruleYear: 1375 }).markers).toEqual([{ kind: 'rule_year', year: 1375, label: 'سال ۷۵' }]);
    expect(buildChartData(items, { ruleYear: 1365 }).markers).toEqual([]);
  });

  it('copes with products that have no data', () => {
    const d = buildChartData([item('e', {})]);
    expect(d.years).toBeNull();
    expect(d.yDomain).toBeNull();
    expect(d.series[0]!.points).toEqual([]);
  });

  it('matches the snapshot for a typical purple group', () => {
    const d = buildChartData(items, { ruleYear: 1375 });
    expect(JSON.stringify(d, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v))).toMatchInlineSnapshot(
      `"{"years":{"min":1370,"max":1400},"yDomain":{"minRials":"50n","maxRials":"10000n"},"series":[{"productId":"a","name":"کالا a","color":"#D9482B","points":[{"year":1370,"rials":"100n","breakBefore":false},{"year":1375,"rials":"1000n","breakBefore":false},{"year":1380,"rials":"10000n","breakBefore":false}]},{"productId":"b","name":"کالا b","color":"#2A6FC9","points":[{"year":1375,"rials":"50n","breakBefore":false},{"year":1400,"rials":"5000n","breakBefore":true}]}],"markers":[{"kind":"rule_year","year":1375,"label":"سال ۷۵"}]}"`,
    );
  });
});

describe('axis helpers', () => {
  const domain = { minRials: 10n, maxRials: 100_000n };
  it('log scale spreads orders of magnitude evenly', () => {
    expect(normalizeY(10n, domain, 'log')).toBeCloseTo(0);
    expect(normalizeY(1_000n, domain, 'log')).toBeCloseTo(0.5);
    expect(normalizeY(100_000n, domain, 'log')).toBeCloseTo(1);
  });
  it('linear scale is proportional and a flat domain sits in the middle', () => {
    expect(normalizeY(50_005n, domain, 'linear')).toBeCloseTo(0.5, 2);
    expect(normalizeY(7n, { minRials: 7n, maxRials: 7n }, 'log')).toBe(0.5);
  });
  it('normalizeX maps years left to right', () => {
    expect(normalizeX(1370, { min: 1370, max: 1400 })).toBe(0);
    expect(normalizeX(1385, { min: 1370, max: 1400 })).toBe(0.5);
    expect(normalizeX(1390, { min: 1390, max: 1390 })).toBe(0.5);
  });
});

describe('compactTomanLabel', () => {
  it.each([
    [5n, '۵ ریال'],
    [1_000n, '۱۰۰ تومن'],
    [12_000n, '۱٫۲ هزار'],
    [30_000_000n, '۳ میلیون'],
    [15_000_000_000n, '۱٫۵ میلیارد'],
  ])('%s -> %s', (rials, label) => {
    expect(compactTomanLabel(rials)).toBe(label);
  });
  it('rejects non-positive prices', () => {
    expect(() => compactTomanLabel(0n)).toThrow();
  });
});
