import { describe, expect, it } from 'vitest';
import { BACK_MOTIFS, BACK_TONES, backSeed } from '../cardBackSeed';

describe('card back seed', () => {
  it('is stable for an id and spreads ids over the colours and motifs', () => {
    expect(backSeed('abc')).toBe(backSeed('abc'));
    const ids = Array.from({ length: 16 }, (_, i) => `card-${i}`);
    expect(new Set(ids.map((id) => backSeed(id) % BACK_TONES.length)).size).toBeGreaterThan(2);
    expect(new Set(ids.map((id) => backSeed(id) % BACK_MOTIFS)).size).toBeGreaterThan(3);
  });
});
