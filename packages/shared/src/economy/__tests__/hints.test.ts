import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../game/rng.js';
import { hintBlock, hintPrice, pickHint } from '../hints.js';
import type { HintGroup, HintPayload, HintRules } from '../hints.js';

const rules: HintRules = { prices: { group_title: 15, one_card: 20, pair: 35 }, minLevel: 2, maxPerGame: 2, repeatPercent: 200 };
const groups: HintGroup[] = [0, 1, 2, 3].map((level) => ({ level, titleFa: `t${level}`, productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`) }));

describe('hint price and limits', () => {
  it('charges the listed price first and the repeat percent afterwards', () => {
    expect(hintPrice('one_card', 0, rules)).toBe(20);
    expect(hintPrice('one_card', 1, rules)).toBe(40);
    expect(hintPrice('pair', 1, { ...rules, repeatPercent: 150 })).toBe(53);
  });
  it('blocks below the level and past the per-game limit', () => {
    expect(hintBlock(1, 0, rules)).toBe('LEVEL');
    expect(hintBlock(2, 0, rules)).toBeNull();
    expect(hintBlock(5, 2, rules)).toBe('LIMIT');
  });
});

describe('pickHint', () => {
  const rng = mulberry32(1);
  it('works on the easiest unsolved group and never repeats a revealed card', () => {
    const given: HintPayload[] = [];
    const first = pickHint('one_card', groups, [], given, rng)!;
    expect(first).toMatchObject({ kind: 'one_card', level: 0 });
    given.push(first);
    const second = pickHint('one_card', groups, [], given, rng)!;
    expect(second.kind === 'one_card' && first.kind === 'one_card' && second.productId !== first.productId).toBe(true);
  });
  it('skips solved groups and moves on when a group has nothing new', () => {
    expect(pickHint('group_title', groups, [0], [], rng)).toEqual({ kind: 'group_title', level: 1, titleFa: 't1' });
    const given: HintPayload[] = [{ kind: 'group_title', level: 1, titleFa: 't1' }];
    expect(pickHint('group_title', groups, [0], given, rng)).toMatchObject({ level: 2 });
    const all = groups.map((g) => ({ kind: 'group_title' as const, level: g.level, titleFa: g.titleFa }));
    expect(pickHint('group_title', groups, [], all, rng)).toBeNull();
  });
  it('a pair gives two distinct cards of one group', () => {
    const p = pickHint('pair', groups, [], [], rng)!;
    expect(p.kind).toBe('pair');
    if (p.kind === 'pair') {
      expect(p.productIds[0]).not.toBe(p.productIds[1]);
      expect(p.productIds.every((id) => id.startsWith('g0'))).toBe(true);
    }
  });
  it('a pair moves to the next group once fewer than two unseen cards are left', () => {
    const given: HintPayload[] = [{ kind: 'pair', level: 0, productIds: ['g0p0', 'g0p1'] }, { kind: 'one_card', level: 0, productId: 'g0p2' }];
    expect(pickHint('pair', groups, [], given, rng)).toMatchObject({ level: 1 });
  });
});
