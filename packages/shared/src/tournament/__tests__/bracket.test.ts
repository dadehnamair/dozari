import { describe, expect, it } from 'vitest';
import { bracketSize, buildBracket, finalPlaces, nextSlot, roundCount, roundName, seedOrder } from '../bracket.js';

describe('bracket', () => {
  it('rounds players up to a power of two', () => {
    expect([1, 2, 3, 4, 5, 8, 9, 16, 17].map(bracketSize)).toEqual([2, 2, 4, 4, 8, 8, 16, 16, 32]);
    expect(roundCount(16)).toBe(4);
  });
  it('seeds so the top two can only meet in the final', () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(seedOrder(16).slice(0, 4)).toEqual([1, 16, 8, 9]);
  });
  it('builds round 1 with byes against the best seeds, then empty later rounds', () => {
    const slots = buildBracket(['p1', 'p2', 'p3', 'p4', 'p5'], 8);
    expect(slots.filter((s) => s.round === 1)).toEqual([
      { round: 1, slot: 0, a: 'p1', b: null },
      { round: 1, slot: 1, a: 'p4', b: 'p5' },
      { round: 1, slot: 2, a: 'p2', b: null },
      { round: 1, slot: 3, a: 'p3', b: null },
    ]);
    expect(slots.filter((s) => s.round === 2)).toHaveLength(2);
    expect(slots.filter((s) => s.round === 3)).toHaveLength(1);
    expect(slots).toHaveLength(7);
  });
  it('a full 4-bracket pairs 1v4 and 2v3', () => {
    expect(buildBracket(['a', 'b', 'c', 'd'], 4).slice(0, 2)).toEqual([
      { round: 1, slot: 0, a: 'a', b: 'd' },
      { round: 1, slot: 1, a: 'b', b: 'c' },
    ]);
  });
  it('knows where winners go and names rounds from the end', () => {
    expect(nextSlot(1, 0, 8)).toEqual({ round: 2, slot: 0, side: 'a' });
    expect(nextSlot(1, 3, 8)).toEqual({ round: 2, slot: 1, side: 'b' });
    expect(nextSlot(3, 0, 8)).toBeNull();
    expect(roundName(3, 8).name).toBe('final');
    expect(roundName(2, 8).name).toBe('semi');
    expect(roundName(1, 8).name).toBe('quarter');
    expect(roundName(1, 16).name).toBe('round');
  });
  it('works out winner, finalist and both semi-final losers', () => {
    const played = [
      { round: 1, a: 'p1', b: 'p4', winner: 'p1' },
      { round: 1, a: 'p2', b: 'p3', winner: 'p3' },
      { round: 2, a: 'p1', b: 'p3', winner: 'p3' },
    ];
    const places = finalPlaces(played, 4);
    expect(places).toContainEqual({ userId: 'p3', place: 1 });
    expect(places).toContainEqual({ userId: 'p1', place: 2 });
    const semis = finalPlaces([{ round: 1, a: 'p1', b: 'p4', winner: 'p1' }, { round: 1, a: 'p2', b: 'p3', winner: 'p2' }, { round: 2, a: 'p1', b: 'p2', winner: 'p1' }], 4);
    expect(semis.filter((p) => p.place === 3).map((p) => p.userId).sort()).toEqual(['p3', 'p4']);
  });
});
