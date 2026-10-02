import { describe, expect, it } from 'vitest';
import { CoinPackageService, refusingVerifier, type ReceiptVerifier } from '../economy/coin-packages.js';
import { createMemoryCoinPackageStore } from '../economy/coin-packages-store.js';

const receipt = { store: 'bazaar' as const, orderId: 'order-1', token: 'tok' };

async function setup(level = 5, verifier: ReceiptVerifier = { verify: async () => true }) {
  const store = createMemoryCoinPackageStore();
  const pkg = await store.addPackage({ titleFa: 'بسته', coins: 500, priceRials: 500_000n, skuBazaar: 'coins_500', skuMyket: null, minLevel: 3, isActive: true });
  return { store, pkg, service: new CoinPackageService(store, async () => level, verifier) };
}

describe('coin packages', () => {
  it('credits a verified purchase once per store order', async () => {
    const { service, pkg, store } = await setup();
    const a = await service.redeem('u1', pkg.id, receipt);
    const b = await service.redeem('u1', pkg.id, receipt);
    expect(a).toMatchObject({ ok: true, balance: 500, duplicate: false });
    expect(b).toMatchObject({ ok: true, balance: 500, duplicate: true });
    expect(store.balances.get('u1')).toBe(500);
  });
  it('credits nothing without a real verifier', async () => {
    const { service, pkg, store } = await setup(5, refusingVerifier);
    expect(await service.redeem('u1', pkg.id, receipt)).toEqual({ ok: false, error: 'not_verified' });
    expect(store.balances.size).toBe(0);
  });
  it('respects the level gate and missing SKU', async () => {
    const low = await setup(2);
    expect(await low.service.redeem('u1', low.pkg.id, receipt)).toMatchObject({ ok: false, error: 'level', minLevel: 3 });
    const { service, pkg } = await setup();
    expect(await service.redeem('u1', pkg.id, { ...receipt, store: 'myket' })).toEqual({ ok: false, error: 'no_sku' });
  });
  it('lists only active packages with a locked flag and toman price', async () => {
    const { service, store } = await setup(2);
    await store.addPackage({ titleFa: 'مخفی', coins: 10, priceRials: 10n, skuBazaar: 'x', skuMyket: null, minLevel: 1, isActive: false });
    const list = await service.list('u1');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ locked: true, priceToman: 50_000 });
  });
});
