import { describe, expect, it } from 'vitest';
import { ShopRealMoney, shopInvoicePayload } from '../economy/shop-real.js';
import { createMemoryShopStore } from '../economy/shop-store.js';

const USER = '00000000-0000-7000-8000-000000000001';
const OTHER = '00000000-0000-7000-8000-000000000002';

async function boot(level = 10) {
  const store = createMemoryShopStore();
  const items = await store.items();
  const pack = items.find((i) => i.effect === 'hint_token' && i.minLevel <= 3)!;
  const hat = items.find((i) => i.effect === 'cosmetic')!;
  await store.updateItem(pack.id, { priceRials: 50_000, skuBazaar: 'sku-pack', skuMyket: null });
  await store.updateItem(hat.id, { priceRials: 80_000, minLevel: 1 });
  let verified = true;
  const real = new ShopRealMoney(store, async () => level, { verify: async () => verified });
  return { store, real, pack, hat, setVerified: (v: boolean) => (verified = v) };
}

describe('shop items for real money', () => {
  it('makes a Bale invoice only for an item with a money price', async () => {
    const { real, pack, store } = await boot();
    const inv = await real.invoice(USER, pack.id);
    expect(inv).toMatchObject({ ok: true, invoice: { amountRials: 50_000, payload: shopInvoicePayload(pack.id, USER) } });
    const free = (await store.items()).find((i) => i.priceRials === 0)!;
    expect(await real.invoice(USER, free.id)).toEqual({ ok: false, error: 'not_for_sale' });
    expect(await real.invoice(USER, '00000000-0000-7000-8000-0000000000ff')).toEqual({ ok: false, error: 'unknown_item' });
  });

  it('refuses a payer who is not the invoice owner and a wrong amount, and answers yes otherwise', async () => {
    const { real, pack } = await boot();
    const payload = shopInvoicePayload(pack.id, USER);
    expect(await real.preCheckout(payload, 50_000, 'IRR', OTHER)).toMatchObject({ ok: false });
    expect(await real.preCheckout(payload, 49_000, 'IRR', USER)).toMatchObject({ ok: false });
    expect(await real.preCheckout(payload, 50_000, 'USD', USER)).toMatchObject({ ok: false });
    expect(await real.preCheckout(payload, 50_000, 'IRR', USER)).toEqual({ ok: true });
  });

  it('grants the item once per charge id', async () => {
    const { real, pack, store } = await boot();
    const payload = shopInvoicePayload(pack.id, USER);
    expect(await real.creditPaid(payload, 'charge-1', 40_000)).toBeNull();
    expect(await real.creditPaid(payload, 'charge-1', 50_000)).toMatchObject({ userId: USER, duplicate: false, text: pack.titleFa });
    expect(await real.creditPaid(payload, 'charge-1', 50_000)).toMatchObject({ duplicate: true });
    expect((await store.wallet(USER)).tokens).toBe(pack.amount);
  });

  it('redeems a store receipt only when verified and the SKU exists; a cosmetic is sold once', async () => {
    const t = await boot();
    const receipt = { store: 'bazaar' as const, orderId: 'order-1', token: 'tok' };
    t.setVerified(false);
    expect(await t.real.redeem(USER, t.pack.id, receipt)).toEqual({ ok: false, error: 'not_verified' });
    t.setVerified(true);
    expect(await t.real.redeem(USER, t.pack.id, { ...receipt, store: 'myket' })).toEqual({ ok: false, error: 'no_sku' });
    expect(await t.real.redeem(USER, t.pack.id, receipt)).toEqual({ ok: true, duplicate: false });
    expect(await t.real.redeem(USER, t.pack.id, receipt)).toEqual({ ok: true, duplicate: true });
    await t.store.updateItem(t.hat.id, { skuBazaar: 'sku-hat' });
    expect(await t.real.redeem(USER, t.hat.id, { ...receipt, orderId: 'order-2' })).toEqual({ ok: true, duplicate: false });
    expect(await t.real.redeem(USER, t.hat.id, { ...receipt, orderId: 'order-3' })).toEqual({ ok: false, error: 'owned' });
  });

  it('checks the level before selling', async () => {
    const t = await boot(1);
    await t.store.updateItem(t.pack.id, { minLevel: 5 });
    expect(await t.real.invoice(USER, t.pack.id)).toEqual({ ok: false, error: 'level', minLevel: 5 });
  });
});
