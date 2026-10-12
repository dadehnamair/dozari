import { describe, expect, it } from 'vitest';
import { DEFAULT_SHOP_ITEMS, createMemoryShopStore } from '../economy/shop-store.js';

describe('match items in the shop', () => {
  it('sells the shuffle for more than any other consumable and the reveal for less than the shuffle', () => {
    const shuffle = DEFAULT_SHOP_ITEMS.find((i) => i.effect === 'shuffle_rival')!;
    const reveal = DEFAULT_SHOP_ITEMS.find((i) => i.effect === 'reveal_group')!;
    expect(shuffle.priceCoins).toBeGreaterThan(reveal.priceCoins);
    const consumables = DEFAULT_SHOP_ITEMS.filter((i) => ['hint_token', 'wheel_spin', 'streak_shield', 'reveal_group'].includes(i.effect) && i.amount === 1);
    expect(consumables.every((i) => i.priceCoins < shuffle.priceCoins)).toBe(true);
  });

  it('holds a bought item until it is used, once per unit, and gives back a refund', async () => {
    const store = createMemoryShopStore();
    store.give('u', 1000);
    const item = (await store.items()).find((i) => i.effect === 'shuffle_rival')!;
    expect(await store.purchase('u', item.id, 0)).toMatchObject({ ok: true });
    expect(await store.matchItems('u')).toEqual({ shuffle: 1, reveal: 0 });
    expect(await store.consumeMatchItem('u', 'shuffle_rival')).toBe(true);
    expect(await store.consumeMatchItem('u', 'shuffle_rival')).toBe(false);
    await store.refundMatchItem('u', 'shuffle_rival');
    expect(await store.matchItems('u')).toEqual({ shuffle: 1, reveal: 0 });
  });
});
