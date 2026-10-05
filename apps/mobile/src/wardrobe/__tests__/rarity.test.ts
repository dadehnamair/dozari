import { describe, expect, it } from 'vitest';
import { rarityOf } from '../rarity';

describe('rarity from the price', () => {
  it('follows the design: coins up to 500 common, more rare; gems below 90 epic, from 90 legendary', () => {
    expect(rarityOf({ currency: 'coins', priceCoins: 0, priceGems: 0 })).toBe('c');
    expect(rarityOf({ currency: 'coins', priceCoins: 500, priceGems: 0 })).toBe('c');
    expect(rarityOf({ currency: 'coins', priceCoins: 501, priceGems: 0 })).toBe('r');
    expect(rarityOf({ currency: 'gems', priceCoins: 0, priceGems: 45 })).toBe('e');
    expect(rarityOf({ currency: 'gems', priceCoins: 0, priceGems: 90 })).toBe('l');
  });
});
