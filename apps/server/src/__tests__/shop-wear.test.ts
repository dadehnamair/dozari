import { describe, expect, it } from 'vitest';
import { isWearKey, WEAR_SLOT_OF, wearKey } from '@dozari/shared';
import { DEFAULT_SHOP_ITEMS } from '../economy/shop-store.js';

describe('default cosmetic shop items', () => {
  const cosmetics = DEFAULT_SHOP_ITEMS.filter((i) => i.effect === 'cosmetic');
  it('use an icon key the character can draw, in the slot that key fits', () => {
    for (const it of cosmetics) {
      expect(isWearKey(it.iconKey ?? ''), it.titleFa).toBe(true);
      expect(WEAR_SLOT_OF[wearKey(it.iconKey)!], it.titleFa).toBe(it.slot);
    }
  });
});
