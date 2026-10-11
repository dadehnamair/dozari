import { describe, expect, it } from 'vitest';
import { YADEGAR_CARDS } from '../yadegarData';
import { dateSegments } from '../yadegarGeometry';

describe("the designer's keepsake art data", () => {
  it('has eight cards: four common with four pieces, four rare with six', () => {
    const cards = Object.values(YADEGAR_CARDS);
    expect(cards).toHaveLength(8);
    expect(cards.filter((c) => c.rare)).toHaveLength(4);
    for (const c of cards) expect(c.pieces).toHaveLength(c.rare ? 6 : 4);
  });
  it('draws the camera date as seven-segment rectangles that stay on the photo', () => {
    const segs = dateSegments("'89 11 07");
    expect(segs.length).toBeGreaterThan(10);
    for (const s of segs) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x + s.w).toBeLessThanOrEqual(300);
      expect(s.y).toBeGreaterThanOrEqual(372);
      expect(s.y + s.h).toBeLessThanOrEqual(400);
    }
    expect(dateSegments('')).toEqual([]);
  });
});
