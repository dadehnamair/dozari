import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../game/rng.js';
import type { CatalogProduct } from '../../puzzle/types.js';
import { PRICE_GUESS_ROUND_POINTS } from '../../config/index.js';
import { applyPriceGuessCommand, priceGuessClientView, priceGuessPoints, roundWinner, startPriceGuess } from '../competitive.js';
import type { PriceGuessState, Side } from '../competitive.js';
import { selectRounds } from '../rounds.js';
import type { PriceGuessRound } from '../rounds.js';
import { guessDistance, parseTomanInput, staircasePoints } from '../scoring.js';

const product = (id: string, prices: Record<number, number>): CatalogProduct => ({
  id,
  category: 'food',
  eraTags: [],
  prices: Object.entries(prices).map(([y, r]) => ({ year: Number(y), month: null, priceRials: BigInt(r) })),
});

describe('staircasePoints', () => {
  it.each([
    [1000n, 1000n, 5],
    [1050n, 1000n, 5], // exactly 5%
    [1051n, 1000n, 4],
    [850n, 1000n, 4], // exactly 15% under
    [849n, 1000n, 3],
    [1300n, 1000n, 3],
    [1301n, 1000n, 2],
    [1600n, 1000n, 2],
    [1601n, 1000n, 1],
    [1n, 1000n, 1],
  ])('guess %s vs %s -> %s points', (guess, actual, points) => {
    expect(staircasePoints(guess, actual)).toBe(points);
  });

  it('rejects a non-positive actual price', () => {
    expect(() => staircasePoints(5n, 0n)).toThrow();
  });

  it('never rewards a worse guess on the same side of the price', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 1n, max: 10n ** 12n }), fc.bigInt({ min: 0n, max: 10n ** 12n }), fc.bigInt({ min: 0n, max: 10n ** 12n }), (actual, x, y) => {
        const [near, far] = x <= y ? [x, y] : [y, x];
        // both guesses at or above the price: the nearer one scores at least as much
        expect(staircasePoints(actual + near, actual)).toBeGreaterThanOrEqual(staircasePoints(actual + far, actual));
      }),
    );
  });
});

describe('parseTomanInput', () => {
  it('reads Persian, Arabic and ASCII digits with separators and returns rials', () => {
    expect(parseTomanInput('۱۰۰')).toBe(1000n);
    expect(parseTomanInput('١٢٣')).toBe(1230n);
    expect(parseTomanInput('1,500,000')).toBe(15_000_000n);
    expect(parseTomanInput('۱٬۵۰۰ ')).toBe(15_000n);
  });
  it('rejects empty, zero, fractions and junk', () => {
    for (const bad of ['', '0', '۰', '12.5', 'abc', '-5', '1e3']) expect(parseTomanInput(bad)).toBeNull();
  });
});

describe('selectRounds', () => {
  const groups = ([0, 1, 2, 3] as const).map((level) => ({ level, productIds: [`p${level}a`, `p${level}b`] }));
  const catalog = ([0, 1, 2, 3] as const).flatMap((l) => [
    product(`p${l}a`, { 1375: 100, 1390: 1_000 }),
    product(`p${l}b`, { 1375: 200, 1400: 5_000 }),
  ]);

  it('gives one round per group, ordered yellow to purple, with the latest priced year by default', () => {
    const rounds = selectRounds([...groups].reverse(), catalog, mulberry32(3));
    expect(rounds.map((r) => r.level)).toEqual([0, 1, 2, 3]);
    for (const r of rounds) {
      expect(r.productId.startsWith(`p${r.level}`)).toBe(true);
      expect(r.year).toBe(r.productId.endsWith('a') ? 1390 : 1400);
    }
  });

  it('uses the rule year when the group has one, and skips items without a price then', () => {
    const g = [{ level: 1 as const, productIds: ['x', 'y'], ruleYear: 1375 }];
    const c = [product('x', { 1380: 9 }), product('y', { 1375: 77 })];
    const rounds = selectRounds(g, c, mulberry32(1));
    expect(rounds).toEqual([{ level: 1, productId: 'y', year: 1375, actualRials: 77n }]);
  });

  it('is reproducible from the seed and skips groups with no usable item', () => {
    expect(selectRounds(groups, catalog, mulberry32(9))).toEqual(selectRounds(groups, catalog, mulberry32(9)));
    expect(selectRounds([{ level: 0, productIds: ['nope'] }], catalog, mulberry32(1))).toEqual([]);
  });
});

describe('roundWinner', () => {
  it('closer wins, equal distance draws, missing guesses lose', () => {
    expect(roundWinner(1000n, 900n, 1300n)).toBe('a');
    expect(roundWinner(1000n, 1300n, 900n)).toBe('b');
    expect(roundWinner(1000n, 900n, 1100n)).toBe('draw');
    expect(roundWinner(1000n, null, 5n)).toBe('b');
    expect(roundWinner(1000n, 5n, null)).toBe('a');
    expect(roundWinner(1000n, null, null)).toBe('draw');
  });

  it('property: the strictly closer side always wins', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 1n, max: 10n ** 9n }), fc.bigInt({ min: 1n, max: 10n ** 9n }), fc.bigInt({ min: 1n, max: 10n ** 9n }), (actual, a, b) => {
        const da = guessDistance(a, actual);
        const db = guessDistance(b, actual);
        expect(roundWinner(actual, a, b)).toBe(da === db ? 'draw' : da < db ? 'a' : 'b');
      }),
    );
  });
});

describe('competitive reducer', () => {
  const rounds: PriceGuessRound[] = [0, 1, 2, 3].map((l) => ({ level: l as 0 | 1 | 2 | 3, productId: `p${l}`, year: 1375, actualRials: BigInt(1000 * (l + 1)) }));
  const submit = (s: PriceGuessState, side: Side, g: bigint) => applyPriceGuessCommand(s, { type: 'submit_guess', side, guessRials: g });

  it('reveals only when both sides have submitted, then moves to the next round', () => {
    let s = startPriceGuess(rounds);
    s = submit(s, 'a', 900n);
    expect(s.index).toBe(0);
    expect(s.revealed).toHaveLength(0);
    s = submit(s, 'b', 1500n);
    expect(s.index).toBe(1);
    expect(s.revealed[0]).toMatchObject({ winner: 'a', actualRials: 1000n, guesses: { a: 900n, b: 1500n } });
  });

  it('ignores resubmission and non-positive guesses', () => {
    let s = startPriceGuess(rounds);
    s = submit(s, 'a', 900n);
    expect(submit(s, 'a', 1n)).toBe(s);
    expect(submit(startPriceGuess(rounds), 'b', 0n).submitted.b).toBe(false);
  });

  it('timeout gives unsubmitted sides the worst guess', () => {
    let s = submit(startPriceGuess(rounds), 'a', 5n);
    s = applyPriceGuessCommand(s, { type: 'timeout' });
    expect(s.revealed[0]).toMatchObject({ winner: 'a', guesses: { a: 5n, b: null } });
    s = applyPriceGuessCommand(s, { type: 'timeout' });
    expect(s.revealed[1]!.winner).toBe('draw');
  });

  it('finishes after the last round, scores points and ignores further commands', () => {
    let s = startPriceGuess(rounds);
    for (let i = 0; i < 4; i++) {
      s = submit(s, 'a', rounds[i]!.actualRials); // exact
      s = submit(s, 'b', 1n);
    }
    expect(s.status).toBe('finished');
    expect(priceGuessPoints(s)).toEqual({ a: 4 * PRICE_GUESS_ROUND_POINTS, b: 0 });
    expect(submit(s, 'a', 5n)).toBe(s);
    expect(applyPriceGuessCommand(s, { type: 'timeout' })).toBe(s);
  });

  it('an empty round list is already finished', () => {
    expect(startPriceGuess([]).status).toBe('finished');
  });

  it('the client view never leaks the price or the opponent number before the reveal', () => {
    let s = startPriceGuess(rounds);
    s = submit(s, 'a', 123_456_789n);
    const forB = priceGuessClientView(s, 'b');
    const json = JSON.stringify(forB, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    expect(json).not.toContain('123456789');
    expect(json).not.toContain('1000'); // actual price of round 0
    expect(forB).toMatchObject({ youSubmitted: false, opponentSubmitted: true, current: { productId: 'p0', year: 1375 } });
    s = submit(s, 'b', 1n);
    expect(priceGuessClientView(s, 'b').revealed[0]!.guesses.a).toBe(123_456_789n);
  });

  it('property: whatever is submitted, the game ends after at most 4 reveals with consistent points', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.constantFrom<Side>('a', 'b'), fc.bigInt({ min: 0n, max: 10n ** 6n })), { maxLength: 30 }), fc.array(fc.boolean(), { maxLength: 30 }), (subs, timeouts) => {
        let s = startPriceGuess(rounds);
        subs.forEach(([side, g], i) => {
          s = submit(s, side, g);
          if (timeouts[i]) s = applyPriceGuessCommand(s, { type: 'timeout' });
        });
        expect(s.revealed.length).toBeLessThanOrEqual(4);
        expect(s.index).toBe(s.revealed.length);
        const pts = priceGuessPoints(s);
        expect(pts.a + pts.b).toBeLessThanOrEqual(s.revealed.length * PRICE_GUESS_ROUND_POINTS);
        expect(s.status === 'finished').toBe(s.revealed.length === 4);
      }),
    );
  });
});

describe('custom staircase (admin settings)', () => {
  it('uses the tiers and the floor that are passed in', () => {
    const tiers = [{ maxErrorPct: 10, points: 9 }, { maxErrorPct: 50, points: 4 }];
    expect(staircasePoints(105n, 100n, tiers, 2)).toBe(9);
    expect(staircasePoints(140n, 100n, tiers, 2)).toBe(4);
    expect(staircasePoints(400n, 100n, tiers, 2)).toBe(2);
  });
});
