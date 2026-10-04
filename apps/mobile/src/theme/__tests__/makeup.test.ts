import { describe, expect, it } from 'vitest';
import { BUILT_IN_WEAR_SLOT_OF } from '@dozari/shared';
import { MAKEUP } from '../makeup-data';

describe('makeup data', () => {
  it('has art for exactly the wearables of the makeup slot', () => {
    const slotKeys = Object.entries(BUILT_IN_WEAR_SLOT_OF).filter(([, s]) => s === 'makeup').map(([k]) => k).sort();
    expect(Object.keys(MAKEUP).sort()).toEqual(slotKeys);
  });
  it('gives every item something to draw, with valid path data', () => {
    for (const [k, m] of Object.entries(MAKEUP)) {
      const parts = [m.blush, m.shadow, m.liner, m.paint, m.dots].filter(Boolean) as string[];
      expect(Boolean(m.lip) || parts.length > 0, k).toBe(true);
      for (const d of parts) expect(d, k).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9 .,\-]+$/);
    }
  });
});
