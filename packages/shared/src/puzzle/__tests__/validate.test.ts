import { describe, expect, it } from 'vitest';
import { validatePuzzle } from '../validate.js';
import type { PuzzleGroupInput } from '../validate.js';
import { fixtureCatalog, fixtureGroups, product } from './fixtures.js';

type Mutable = { groups: PuzzleGroupInput[] };
const valid = (): Mutable => ({ groups: fixtureGroups.map((g) => ({ ...g, productIds: [...g.productIds] })) });
const codes = (r: { errors: { code: string }[] }) => r.errors.map((e) => e.code);

describe('validatePuzzle', () => {
  it('accepts a well-formed puzzle and reports the red herrings', () => {
    const r = validatePuzzle(valid(), fixtureCatalog());
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.nearMisses.map((n) => n.productId).sort()).toEqual(['a1', 'a2']);
    expect(r.warnings).toEqual([]);
    expect(r.score).toBe(100);
  });

  it('rejects wrong shapes', () => {
    const catalog = fixtureCatalog();
    const three = valid();
    three.groups = three.groups.slice(0, 3);
    expect(codes(validatePuzzle(three, catalog))).toContain('shape.group_count');

    const dupLevel = valid();
    dupLevel.groups[1] = { ...dupLevel.groups[1]!, level: 0 };
    expect(codes(validatePuzzle(dupLevel, catalog))).toContain('shape.levels');

    const small = valid();
    small.groups[0] = { ...small.groups[0]!, productIds: ['a1', 'a2', 'a3'] };
    expect(codes(validatePuzzle(small, catalog))).toContain('shape.group_size');

    const dup = valid();
    dup.groups[0] = { ...dup.groups[0]!, productIds: ['a1', 'a2', 'a3', 'b1'] };
    expect(codes(validatePuzzle(dup, catalog))).toContain('shape.duplicate_product');

    const unknown = valid();
    unknown.groups[0] = { ...unknown.groups[0]!, productIds: ['a1', 'a2', 'a3', 'zzz'] };
    expect(codes(validatePuzzle(unknown, catalog))).toContain('shape.unknown_product');
  });

  it('rejects an item that does not satisfy its own rule', () => {
    const catalog = fixtureCatalog().map((p) => (p.id === 'b1' ? product('b1', 'food', { 1370: 100, 1375: 5_000_000, 1380: 30_000_000, 1400: 100 }) : p));
    const r = validatePuzzle(valid(), catalog);
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('membership.fails');
  });

  it('rejects an item that also fits another group (ambiguous solution)', () => {
    // a3 now also sits inside B's band
    const catalog = fixtureCatalog().map((p) => (p.id === 'a3' ? { ...p, prices: p.prices.map((x) => (x.year === 1375 ? { ...x, priceRials: 1_000_000n } : x)) } : p));
    const r = validatePuzzle(valid(), catalog);
    expect(r.ok).toBe(false);
    expect(r.errors.find((e) => e.code === 'uniqueness.ambiguous')?.productId).toBe('a3');
  });

  it('rejects missing data, both for members and for outsiders that cannot be ruled out', () => {
    const noMember = fixtureCatalog().map((p) => (p.id === 'b2' ? product('b2', 'snack', { 1370: 100 }) : p));
    expect(codes(validatePuzzle(valid(), noMember))).toContain('data.missing');

    // d1 has no 1375 price: it is a member of D (needs 1370/1400 only) but cannot be proven outside B
    const noOutsider = fixtureCatalog().map((p) => (p.id === 'd1' ? product('d1', 'car', { 1370: 10_000, 1380: 60_000_000, 1400: 1_000_000 }) : p));
    expect(codes(validatePuzzle(valid(), noOutsider))).toContain('uniqueness.unverifiable');
  });

  it('skips rule checks for curated groups but still protects the other groups', () => {
    const p = valid();
    p.groups[3] = { level: 3, rule: { kind: 'curated', note: 'hand made' }, productIds: ['d1', 'd2', 'd3', 'd4'] };
    // d-items have no data issue for curated; they must still fail B's band etc. (they do)
    expect(validatePuzzle(p, fixtureCatalog()).ok).toBe(true);

    // a curated item sneaking into B's band still breaks B's uniqueness
    const catalog = fixtureCatalog().map((x) => (x.id === 'd1' ? { ...x, prices: x.prices.map((y) => (y.year === 1375 ? { ...y, priceRials: 1_000_000n } : y)) } : x));
    expect(codes(validatePuzzle(p, catalog))).toContain('uniqueness.ambiguous');
  });

  it('warns (without failing) on few near misses, thin diversity and inverted difficulty', () => {
    // Move a1/a2 far from B's band: no near misses left
    const noNear = fixtureCatalog().map((x) => (x.id === 'a1' || x.id === 'a2' ? { ...x, prices: x.prices.map((y) => (y.year === 1375 ? { ...y, priceRials: 9_000_000n } : y)) } : x));
    const r1 = validatePuzzle(valid(), noNear);
    expect(r1.ok).toBe(true);
    expect(r1.warnings.map((w) => w.code)).toContain('quality.few_near_misses');
    expect(r1.score).toBe(90);

    // Everything in one category
    const oneCat = fixtureCatalog().map((x) => ({ ...x, category: 'food' }));
    const r2 = validatePuzzle(valid(), oneCat);
    expect(r2.ok).toBe(true);
    expect(r2.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(['diversity.category_cap', 'diversity.category_count']));

    // Swap levels: the easy era anchor becomes purple and the x100 multiplier becomes yellow
    const inverted = valid();
    inverted.groups[0] = { ...inverted.groups[0]!, level: 3 };
    inverted.groups[3] = { ...inverted.groups[3]!, level: 0 };
    const r3 = validatePuzzle(inverted, fixtureCatalog());
    expect(r3.ok).toBe(true);
    expect(r3.warnings.map((w) => w.code)).toContain('difficulty.order');
  });
});
