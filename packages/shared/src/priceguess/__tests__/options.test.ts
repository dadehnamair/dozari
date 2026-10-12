import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../game/rng.js';
import { PRICE_OPTION_COUNT, buildPriceOptions } from '../options.js';

describe('buildPriceOptions', () => {
  it('offers four distinct positive whole-toman choices that include the real price, ascending', () => {
    for (const actual of [50n, 120n, 1_500n, 35_000n, 480_000n, 12_345_670n, 9_000_000_000n]) {
      for (let seed = 1; seed <= 25; seed++) {
        const o = buildPriceOptions(actual, mulberry32(seed));
        expect(o).toHaveLength(PRICE_OPTION_COUNT);
        expect(o).toContain(actual);
        expect(new Set(o).size).toBe(PRICE_OPTION_COUNT);
        expect(o.every((v) => v > 0n && v % 10n === 0n)).toBe(true);
        expect([...o].sort((a, b) => (a < b ? -1 : 1))).toEqual(o);
      }
    }
  });

  it('is deterministic for a seed and varies the decoys across seeds', () => {
    expect(buildPriceOptions(480_000n, mulberry32(3))).toEqual(buildPriceOptions(480_000n, mulberry32(3)));
    const sets = new Set(Array.from({ length: 20 }, (_, s) => buildPriceOptions(480_000n, mulberry32(s)).join(',')));
    expect(sets.size).toBeGreaterThan(3);
  });

  it('puts the real price at different ranks, so the middle is not a giveaway', () => {
    const ranks = new Set(Array.from({ length: 60 }, (_, s) => buildPriceOptions(480_000n, mulberry32(s)).indexOf(480_000n)));
    expect(ranks.size).toBeGreaterThan(1);
  });

  it('decoys look as round as the real price (a round price gets round decoys)', () => {
    const o = buildPriceOptions(500_000n, mulberry32(9));
    expect(o.every((v) => v % 10_000n === 0n)).toBe(true);
  });

  it('rejects a non-positive price', () => {
    expect(() => buildPriceOptions(0n, mulberry32(1))).toThrow(RangeError);
  });
});
