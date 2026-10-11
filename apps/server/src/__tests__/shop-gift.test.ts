import { describe, expect, it } from 'vitest';
import { SHOP_GIFT_MAX_COINS } from '@dozari/shared';
import { ShopService } from '../economy/shop.js';
import { createMemoryShopStore } from '../economy/shop-store.js';

function boot(opts: { birthday?: boolean; friends?: boolean } = {}) {
  const store = createMemoryShopStore();
  const told: { giver: string; to: string; title: string }[] = [];
  const svc = new ShopService(
    store,
    async () => 5,
    Date.now,
    undefined,
    async (giver, to) => (opts.friends === false ? { ok: false, error: 'not_friends' } : opts.birthday === false ? { ok: false, error: 'not_birthday' } : { ok: true, key: `${giver}:${to}:1405` }),
    (giver, to, item) => told.push({ giver, to, title: item.titleFa }),
  );
  return { store, svc, told };
}

describe('birthday gifts from the shop', () => {
  it('a friend in their birthday week gets a hint pack; the giver pays; the friend is told; once per item per birthday', async () => {
    const { store, svc, told } = boot();
    store.give('giver', 200);
    const items = await store.items();
    const pack = items.find((i) => i.effect === 'hint_token' && i.priceCoins <= SHOP_GIFT_MAX_COINS)!;
    const out = await svc.gift('giver', 'friend', pack.id);
    expect(out).toEqual({ ok: true, balance: 200 - pack.priceCoins });
    expect((await store.wallet('friend')).tokens).toBe(pack.amount);
    expect(told).toEqual([{ giver: 'giver', to: 'friend', title: pack.titleFa }]);
    expect(await svc.gift('giver', 'friend', pack.id)).toEqual({ ok: false, error: 'duplicate' });
    expect((await store.wallet('giver')).balance).toBe(200 - pack.priceCoins);
  });
  it('refuses a stranger, a friend whose birthday is not near, yourself, an item that is too dear or an owned kind, and a giver without coins', async () => {
    const stranger = boot({ friends: false });
    stranger.store.give('g', 500);
    const any = (await stranger.store.items()).find((i) => i.effect === 'hint_token' && i.priceCoins <= SHOP_GIFT_MAX_COINS)!;
    expect(await stranger.svc.gift('g', 'x', any.id)).toEqual({ ok: false, error: 'not_friends' });
    const noBirthday = boot({ birthday: false });
    noBirthday.store.give('g', 500);
    expect(await noBirthday.svc.gift('g', 'x', any.id)).toEqual({ ok: false, error: 'not_birthday' });
    const t = boot();
    t.store.give('g', 1000);
    expect(await t.svc.gift('g', 'g', any.id)).toEqual({ ok: false, error: 'self' });
    const dear = (await t.store.items()).find((i) => i.effect === 'hint_token' && i.priceCoins > SHOP_GIFT_MAX_COINS)!;
    expect(await t.svc.gift('g', 'x', dear.id)).toEqual({ ok: false, error: 'not_giftable' });
    const hat = (await t.store.items()).find((i) => i.effect === 'cosmetic')!;
    expect(await t.svc.gift('g', 'x', hat.id)).toEqual({ ok: false, error: 'not_giftable' });
    const poor = boot();
    expect(await poor.svc.gift('nobody', 'x', any.id)).toEqual({ ok: false, error: 'insufficient' });
    expect(poor.told).toEqual([]);
  });
});
