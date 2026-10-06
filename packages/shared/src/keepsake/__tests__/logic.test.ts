import { describe, expect, it } from 'vitest';
import { SHOWCASE_MAX } from '../../config/economy.js';
import { cleanShowcase, completionPercent, isComplete, missingPieces, piecePrice, rollDrop, shopPiece, upgradeCost } from '../logic.js';
import type { KeepsakeDef } from '../logic.js';

const defs: KeepsakeDef[] = [
  { id: 'a', rarity: 'common', pieces: 4 },
  { id: 'b', rarity: 'rare', pieces: 4 },
  { id: 'c', rarity: 'legendary', pieces: 6 },
];

describe('keepsake rules', () => {
  it('knows what is missing and when a keepsake is complete', () => {
    expect(missingPieces(defs[0]!, { owned: [1, 3] })).toEqual([2, 4]);
    expect(isComplete(defs[0]!, { owned: [1, 2, 3, 4] })).toBe(true);
    expect(isComplete(defs[0]!, undefined)).toBe(false);
  });
  it('prices pieces by rarity and upgrades by level, with no upgrade past the top', () => {
    expect(piecePrice('common')).toBe(60);
    expect(piecePrice('legendary')).toBe(240);
    expect(upgradeCost(1)).toBe(150);
    expect(upgradeCost(2)).toBe(300);
    expect(upgradeCost(3)).toBeNull();
  });
  it('rolls the same drop for the same seed key and never a duplicate piece', () => {
    const progress = new Map([['a', { owned: [1, 2, 3] }]]);
    let drops = 0;
    for (let i = 0; i < 400; i++) {
      const key = `match-${i}:user`;
      const d = rollDrop(defs, progress, key, 1);
      expect(rollDrop(defs, progress, key, 1)).toEqual(d);
      if (d?.keepsakeId === 'a') expect(d.piece).toBe(4);
      if (d) drops += 1;
    }
    expect(drops).toBe(400);
  });
  it('honours the chance, skips completed keepsakes, and drops nothing when all are complete', () => {
    const progress = new Map(defs.map((d) => [d.id, { owned: Array.from({ length: d.pieces }, (_, i) => i + 1) }]));
    expect(rollDrop(defs, progress, 'k', 1)).toBeNull();
    let hits = 0;
    for (let i = 0; i < 2000; i++) if (rollDrop(defs, new Map(), `m${i}:u`, 0.15)) hits += 1;
    expect(hits).toBeGreaterThan(220);
    expect(hits).toBeLessThan(380);
  });
  it('favours common keepsakes over legendary ones by weight', () => {
    const count: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 3000; i++) {
      const d = rollDrop(defs, new Map(), `m${i}:u`, 1)!;
      count[d.keepsakeId] = (count[d.keepsakeId] ?? 0) + 1;
    }
    expect(count.a!).toBeGreaterThan(count.b!);
    expect(count.b!).toBeGreaterThan(count.c!);
  });
  it('gives a shop piece the player lacks, none when complete', () => {
    expect(shopPiece(defs[0]!, { owned: [1, 2, 4] }, 'p1')).toBe(3);
    expect(shopPiece(defs[0]!, { owned: [1, 2, 3, 4] }, 'p1')).toBeNull();
  });
  it('accepts a showcase of distinct completed keepsakes up to the maximum only', () => {
    const done = new Set(['a', 'b', 'c']);
    expect(cleanShowcase(['b', 'a'], done)).toEqual(['b', 'a']);
    expect(cleanShowcase(['a', 'a'], done)).toBeNull();
    expect(cleanShowcase(['a', 'zzz'], done)).toBeNull();
    expect(cleanShowcase(Array.from({ length: SHOWCASE_MAX + 1 }, (_, i) => `x${i}`), new Set(Array.from({ length: SHOWCASE_MAX + 1 }, (_, i) => `x${i}`)))).toBeNull();
  });
  it('computes whole-percent completion', () => {
    expect(completionPercent(1, 3)).toBe(33);
    expect(completionPercent(0, 0)).toBe(0);
  });
});
