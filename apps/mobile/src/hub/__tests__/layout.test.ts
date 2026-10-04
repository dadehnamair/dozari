import { describe, expect, it } from 'vitest';
import { buildingParts } from '../buildings';
import { HUB_BUILDINGS, canEnter } from '../layout';

const on = { daily: true, duel: true, tournament: true };

describe('hub', () => {
  it('has six buildings with unique keys; only the existing modes (and the school) can be entered', () => {
    expect(new Set(HUB_BUILDINGS.map((b) => b.key)).size).toBe(6);
    expect(HUB_BUILDINGS.filter((b) => canEnter(b, on)).map((b) => b.key).sort()).toEqual(['caravan', 'maktab', 'shop', 'tower', 'zur']);
  });

  it('a switched-off mode cannot be entered', () => {
    const duel = HUB_BUILDINGS.find((b) => b.key === 'zur')!;
    expect(canEnter(duel, { ...on, duel: false })).toBe(false);
    expect(canEnter(HUB_BUILDINGS.find((b) => b.key === 'shop')!, { daily: false, duel: false, tournament: false })).toBe(true);
  });

  it('draws every building as a non-empty list of filled paths', () => {
    for (const b of HUB_BUILDINGS) {
      const parts = buildingParts(b);
      expect(parts.length).toBeGreaterThan(5);
      expect(parts.every((p) => p.d.startsWith('M'))).toBe(true);
    }
  });
});
