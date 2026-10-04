import type { ShopItem } from '@dozari/shared';

/** Rarity as in the design «21 Cosmetic Packs»: c common, r rare, e epic, l legendary. */
export type Rarity = 'c' | 'r' | 'e' | 'l';

/** Name, badge colour and card backdrop of each rarity (from the design). */
export const RARITY: Record<Rarity, { name: string; color: string; backdrop: string }> = {
  c: { name: 'معمولی', color: '#8FDCFA', backdrop: '#CDEFFB' },
  r: { name: 'کمیاب', color: '#B8F08F', backdrop: '#DDF5CB' },
  e: { name: 'حماسی', color: '#C9A2F7', backdrop: '#E8DAFB' },
  l: { name: 'افسانه‌ای', color: '#FFC93C', backdrop: '#FFE9A8' },
};

/**
 * Items carry no rarity field, so it follows the price like in the design: coins up to 500 are common, dearer coin items rare;
 * gems below 90 epic, 90 and above legendary. The owner prices items in the admin panel, so a repricing moves the rarity with it.
 */
export function rarityOf(it: Pick<ShopItem, 'currency' | 'priceCoins' | 'priceGems'>): Rarity {
  if (it.currency === 'gems') return it.priceGems >= 90 ? 'l' : 'e';
  return it.priceCoins > 500 ? 'r' : 'c';
}
