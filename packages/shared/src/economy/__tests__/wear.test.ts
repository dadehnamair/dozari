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
