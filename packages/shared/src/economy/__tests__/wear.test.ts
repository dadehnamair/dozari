import { describe, expect, it } from 'vitest';
import { isWearKey, wearKey, WEAR_SLOT_OF } from '../wear.js';

describe('wear keys', () => {
  it('maps the old generic hat key to the shapoo', () => {
    expect(wearKey('hat')).toBe('shapoo');
    expect(isWearKey('hat')).toBe(true);
    expect(WEAR_SLOT_OF[wearKey('hat')!]).toBe('hat');
  });
  it('knows nothing about plain shop icons', () => {
    expect(wearKey(null)).toBeNull();
    expect(isWearKey('magnifier')).toBe(false);
  });
});

describe('svg-drawn wearables', () => {
  it('never move a built-in wearable to another slot', async () => {
    const { BUILT_IN_WEAR_SLOT_OF } = await import('../wear.js');
    const { GENERATED_WEAR_SLOT_OF } = await import('../wear-generated.js');
    for (const [k, slot] of Object.entries(GENERATED_WEAR_SLOT_OF)) {
      if (k in BUILT_IN_WEAR_SLOT_OF) expect(slot, k).toBe(BUILT_IN_WEAR_SLOT_OF[k]);
    }
  });
});
