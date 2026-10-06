import { describe, expect, it } from 'vitest';
import { mulberry32, shopSchema, soloHintResultSchema, soloHintsSchema } from '@dozari/shared';
import type { HintRules } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { ShopService } from '../economy/shop.js';
import { createMemoryShopStore } from '../economy/shop-store.js';
import { HintService } from '../solo/hints.js';
import { SoloService } from '../solo/service.js';
import type { ServedPuzzle } from '../solo/types.js';

function memoryUsers(): UserRepository {
  const byId = new Map<string, UserRecord & { deviceId: string }>();
  return {
    async findByDeviceId(d) {
      return [...byId.values()].find((u) => u.deviceId === d) ?? null;
    },
    async findById(id) {
      return byId.get(id) ?? null;
    },
    async createGuest(deviceId, identity) {
      const user = { id: `00000000-0000-7000-8000-${String(byId.size + 1).padStart(12, '0')}`, deviceId, ...identity, isBanned: false };
      byId.set(user.id, user);
      return user;
    },
    async touch() {},
  };
}

const puzzle: ServedPuzzle = {
  id: 'pz',
  groups: ([0, 1, 2, 3] as const).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`), titleFa: `عنوان ${level}`, explanationFa: 'e' })),
  items: Object.fromEntries([0, 1, 2, 3].flatMap((l) => [0, 1, 2, 3].map((i) => [`g${l}p${i}`, { nameFa: 'x', unitFa: null }]))),
};

function boot(level = 3, maxPerGame = 2) {
  const rules: HintRules = { prices: { group_title: 15, one_card: 20, pair: 35 }, minLevel: 2, maxPerGame, repeatPercent: 200 };
  const store = createMemoryShopStore();
  const levels = new Map<string, number>();
  const levelOf = async (id: string) => levels.get(id) ?? level;
  const solo = new SoloService({ pickRandom: async () => puzzle, pricesFor: async () => ({}) });
  const auth = new AuthService(memoryUsers(), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
  const app = buildServer({ auth, solo, hints: new HintService(solo, store, async () => rules, levelOf), shop: new ShopService(store, levelOf, () => store.now.ms) });
  const login = async (n: number) => {
    const r = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}` } })).json() as { token: string; user: { id: string } };
    return { h: { authorization: `Bearer ${r.token}` }, id: r.user.id };
  };
  const start = async (h: Record<string, string>) => ((await app.inject({ method: 'POST', url: '/solo/start', headers: h })).json() as { sessionId: string }).sessionId;
  return { app, login, store, levels, start };
}

describe('coin shop', () => {
  it('lists items with why they are blocked, and buying debits coins and grants tokens', async () => {
    const { app, login, store } = boot(3);
    const a = await login(1);
    store.give(a.id, 100);
    const shop = shopSchema.parse((await app.inject({ method: 'GET', url: '/shop', headers: a.h })).json());
    expect(shop).toMatchObject({ balance: 100, level: 3, tokens: 0 });
    // Level 3: the first two items and the streak shield are open, the higher tiers (levels 10 / 20 / 35) are locked.
    expect(shop.items.slice(0, 8).map((i) => i.blocked)).toEqual([null, null, null, 'LEVEL', 'LEVEL', 'LEVEL', null, 'LEVEL']);
    expect(shop.items.slice(0, 8).map((i) => i.minLevel)).toEqual([2, 3, 2, 10, 20, 35, 3, 5]);
    const pack = shop.items[1]!;
    const bought = (await app.inject({ method: 'POST', url: `/shop/${pack.id}/buy`, headers: a.h })).json();
    expect(bought).toEqual({ balance: 20, gems: 0, tokens: 5 });
    expect(store.ledger).toEqual([{ userId: a.id, delta: -80, reason: 'shop_purchase' }]);
    const again = await app.inject({ method: 'POST', url: `/shop/${pack.id}/buy`, headers: a.h });
    expect(again.statusCode).toBe(402);
    expect(again.json()).toEqual({ error: 'insufficient' });
  });

  it('enforces the level gate and the daily limit, which resets at Tehran midnight', async () => {
    const { app, login, store, levels } = boot(2);
    const a = await login(1);
    store.give(a.id, 1000);
    const [single, pack] = shopSchema.parse((await app.inject({ method: 'GET', url: '/shop', headers: a.h })).json()).items as unknown as [{ id: string }, { id: string }];
    const locked = await app.inject({ method: 'POST', url: `/shop/${pack.id}/buy`, headers: a.h });
    expect(locked.statusCode).toBe(403);
    expect(locked.json()).toEqual({ error: 'level', minLevel: 3 });
    expect(shopSchema.parse((await app.inject({ method: 'GET', url: '/shop', headers: a.h })).json()).items[1]!.blocked).toBe('LEVEL');
    levels.set(a.id, 3);
    store.now.ms = Date.UTC(2026, 9, 1, 12, 0);
    for (let i = 0; i < 3; i++) expect((await app.inject({ method: 'POST', url: `/shop/${pack.id}/buy`, headers: a.h })).statusCode).toBe(200);
    const over = await app.inject({ method: 'POST', url: `/shop/${pack.id}/buy`, headers: a.h });
    expect(over.statusCode).toBe(409);
    expect(over.json()).toEqual({ error: 'daily_limit' });
    expect(shopSchema.parse((await app.inject({ method: 'GET', url: '/shop', headers: a.h })).json()).items[1]).toMatchObject({ blocked: 'DAILY_LIMIT', leftToday: 0 });
    expect((await app.inject({ method: 'POST', url: `/shop/${single.id}/buy`, headers: a.h })).statusCode).toBe(200); // other items unaffected
    store.now.ms = Date.UTC(2026, 9, 1, 21, 0); // past 20:30 UTC = next Tehran day
    expect((await app.inject({ method: 'POST', url: `/shop/${pack.id}/buy`, headers: a.h })).statusCode).toBe(200);
  });

  it('needs sign-in and a real item', async () => {
    const { app, login } = boot();
    const a = await login(1);
    expect((await app.inject({ method: 'GET', url: '/shop' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/shop/00000000-0000-7000-8000-0000000000ff/buy', headers: a.h })).statusCode).toBe(404);
  });
});

describe('solo hints', () => {
  const hint = (app: ReturnType<typeof boot>['app'], h: Record<string, string>, id: string, kind: string) => app.inject({ method: 'POST', url: `/solo/${id}/hint`, headers: h, payload: { kind } });

  it('charges coins, escalates the price, stops at the per-game limit', async () => {
    const { app, login, store, start } = boot(3);
    const a = await login(1);
    store.give(a.id, 100);
    const id = await start(a.h);
    const opts = soloHintsSchema.parse((await app.inject({ method: 'GET', url: `/solo/${id}/hints`, headers: a.h })).json());
    expect(opts.options).toEqual([{ kind: 'group_title', price: 15 }, { kind: 'one_card', price: 20 }, { kind: 'pair', price: 35 }]);
    const first = soloHintResultSchema.parse((await hint(app, a.h, id, 'group_title')).json());
    expect(first).toMatchObject({ hint: { kind: 'group_title', level: 0, titleFa: 'عنوان 0' }, paidWith: 'coins', balance: 85 });
    const second = soloHintResultSchema.parse((await hint(app, a.h, id, 'one_card')).json());
    expect(second.balance).toBe(45); // 20 × 2
    expect((await hint(app, a.h, id, 'pair')).json()).toEqual({ error: 'limit' });
    const after = soloHintsSchema.parse((await app.inject({ method: 'GET', url: `/solo/${id}/hints`, headers: a.h })).json());
    expect(after.given).toHaveLength(2);
    expect(after.blocked).toBe('LIMIT');
    expect(store.ledger.map((l) => l.delta)).toEqual([-15, -40]);
  });

  it('gives level-1 players a free nudge (two cards, twice a game) and nobody else', async () => {
    const { app, login, store, start, levels } = boot(3);
    const a = await login(1);
    const id = await start(a.h);
    levels.set(a.id, 1);
    const nudge = () => app.inject({ method: 'POST', url: `/solo/${id}/nudge`, headers: a.h });
    const first = (await nudge()).json();
    expect(first.hint.kind).toBe('pair');
    expect((await nudge()).statusCode).toBe(200);
    const third = await nudge();
    expect(third.statusCode).toBe(409);
    expect(third.json()).toEqual({ error: 'limit' });
    expect(store.ledger).toEqual([]);
    levels.set(a.id, 2);
    expect((await nudge()).json()).toEqual({ error: 'level' });
    expect((await app.inject({ method: 'POST', url: `/solo/${id}/nudge` })).statusCode).toBe(401);
  });

  it('uses a hint token before coins', async () => {
    const { app, login, store, start } = boot(3);
    const a = await login(1);
    store.give(a.id, 50, 1);
    const id = await start(a.h);
    expect(soloHintResultSchema.parse((await hint(app, a.h, id, 'pair')).json())).toMatchObject({ paidWith: 'token', balance: 50, tokens: 0 });
    expect(store.ledger).toEqual([]);
  });

  it('refuses without enough coins, below the level, for someone else, anonymous and after the game', async () => {
    const { app, login, store, start, levels } = boot(3);
    const a = await login(1);
    const b = await login(2);
    const id = await start(a.h);
    expect((await hint(app, a.h, id, 'pair')).statusCode).toBe(402);
    store.give(a.id, 500);
    expect((await hint(app, b.h, id, 'pair')).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: `/solo/${id}/hint`, payload: { kind: 'pair' } })).statusCode).toBe(401);
    levels.set(a.id, 1);
    expect((await hint(app, a.h, id, 'pair')).json()).toEqual({ error: 'level' });
    levels.set(a.id, 3);
    for (const level of [0, 1, 2, 3]) await app.inject({ method: 'POST', url: `/solo/${id}/guess`, payload: { productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`) } });
    expect((await hint(app, a.h, id, 'pair')).json()).toEqual({ error: 'game_over' });
    expect((await app.inject({ method: 'POST', url: `/solo/${id}/hint`, headers: a.h, payload: { kind: 'bogus' } })).statusCode).toBe(400);
    expect(store.ledger).toEqual([]); // nothing was ever charged
  });

  it('never charges when there is nothing left to reveal', async () => {
    const { app, login, store, start } = boot(3, 5);
    const a = await login(1);
    store.give(a.id, 500);
    const id = await start(a.h);
    for (const level of [0, 1]) await app.inject({ method: 'POST', url: `/solo/${id}/guess`, payload: { productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`) } });
    // Groups 2 and 3 are open: each title can be revealed once, then there is nothing left to show.
    expect((await hint(app, a.h, id, 'group_title')).statusCode).toBe(200);
    expect((await hint(app, a.h, id, 'group_title')).statusCode).toBe(200);
    expect((await hint(app, a.h, id, 'group_title')).json()).toEqual({ error: 'nothing_left' });
    expect(store.ledger).toHaveLength(2);
  });

  it('sells a gem-priced item for gems and leaves coins alone', async () => {
    const { app, login, store } = boot(5);
    const a = await login(7);
    const [it] = await store.items();
    await store.updateItem(it!.id, { currency: 'gems', priceGems: 3, minLevel: 1 });
    store.give(a.id, 50, 0, 2);
    const poor = shopSchema.parse((await app.inject({ method: 'GET', url: '/shop', headers: a.h })).json());
    expect(poor.items.find((x) => x.id === it!.id)).toMatchObject({ currency: 'gems', priceGems: 3, blocked: 'GEMS' });
    expect((await app.inject({ method: 'POST', url: `/shop/${it!.id}/buy`, headers: a.h })).statusCode).toBe(402);
    store.give(a.id, 0, 0, 5);
    const res = await app.inject({ method: 'POST', url: `/shop/${it!.id}/buy`, headers: a.h });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ balance: 50, gems: 4 });
    expect(store.gemLedger).toEqual([{ userId: a.id, delta: -3, reason: 'shop_purchase' }]);
  });

  it('sells a cosmetic once, lets the owner wear one item per slot, and lists what is worn', async () => {
    const { app, login, store } = boot(10);
    const a = await login(8);
    store.give(a.id, 1000);
    const items = await store.items();
    const hats = items.filter((i) => i.effect === 'cosmetic' && i.slot === 'hat' && i.currency === 'coins');
    const hat = hats[0]!;
    const crown = items.find((i) => i.slot === 'hat' && i.currency === 'gems')!;
    expect((await app.inject({ method: 'POST', url: `/shop/${hat.id}/buy`, headers: a.h })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/shop/${hat.id}/buy`, headers: a.h })).statusCode).toBe(409);
    expect(store.ledger.filter((l) => l.reason === 'shop_purchase')).toHaveLength(1);
    const shop = shopSchema.parse((await app.inject({ method: 'GET', url: '/shop', headers: a.h })).json());
    expect(shop.items.find((x) => x.id === hat.id)).toMatchObject({ owned: true, blocked: 'OWNED', slot: 'hat' });
    expect((await app.inject({ method: 'POST', url: `/shop/${hat.id}/equip`, headers: a.h, payload: { equipped: true } })).json()).toMatchObject({ ok: true, worn: [{ id: hat.id, slot: 'hat' }] });
    store.give(a.id, 0, 0, 100);
    await app.inject({ method: 'POST', url: `/shop/${crown.id}/buy`, headers: a.h });
    const worn = (await app.inject({ method: 'POST', url: `/shop/${crown.id}/equip`, headers: a.h, payload: { equipped: true } })).json() as { worn: { id: string }[] };
    expect(worn.worn.map((w) => w.id)).toEqual([crown.id]);
    expect((await app.inject({ method: 'POST', url: `/shop/${items[0]!.id}/equip`, headers: a.h, payload: { equipped: true } })).statusCode).toBe(404);
  });
});

describe('streak shield in the shop', () => {
  it('sells a shield for coins, holds at most two, and says why a third is blocked', async () => {
    const { app, login, store } = boot(3);
    const a = await login(1);
    store.give(a.id, 500);
    const list = async () => shopSchema.parse((await app.inject({ method: 'GET', url: '/shop', headers: a.h })).json());
    const shield = (await list()).items.find((i) => i.effect === 'streak_shield')!;
    expect(shield).toMatchObject({ priceCoins: 30, blocked: null, minLevel: 2 });
    const buy = () => app.inject({ method: 'POST', url: `/shop/${shield.id}/buy`, headers: a.h });
    expect((await buy()).statusCode).toBe(200);
    store.now.ms += 86_400_000 * 2; // the next Tehran days: one shield a day
    expect((await buy()).statusCode).toBe(200);
    const full = await list();
    expect(full.shields).toBe(2);
    expect(full.items.find((i) => i.effect === 'streak_shield')!.blocked).toBe('MAX_HELD');
    store.now.ms += 86_400_000 * 2;
    const third = await buy();
    expect(third.statusCode).toBe(409);
    expect(third.json()).toEqual({ error: 'max_held' });
  });
});

describe('daily rotating shop', () => {
  const rotatingSeed = (n: number) => Array.from({ length: n }, (_, i) => ({ titleFa: `کالا ${i}`, descriptionFa: '', effect: 'cosmetic' as const, amount: 1, priceCoins: 50, currency: 'coins' as const, priceGems: 0, priceRials: 0, skuBazaar: null, skuMyket: null, minLevel: 1, perDayLimit: 0, slot: 'hat' as const, iconKey: null, isActive: true, rotating: true }));
  function rotatingApp(slots: number) {
    const store = createMemoryShopStore([...rotatingSeed(8), { ...rotatingSeed(1)[0]!, titleFa: 'همیشگی', rotating: false }]);
    const auth = new AuthService(memoryUsers(), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
    const app = buildServer({ auth, shop: new ShopService(store, async () => 5, () => store.now.ms, async () => slots) });
    return { app, store, auth };
  }
  const login = async (app: ReturnType<typeof buildServer>) => {
    const r = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: '0f8fad5b-d9cb-469f-a165-708677289501' } })).json() as { token: string; user: { id: string } };
    return { h: { authorization: `Bearer ${r.token}` }, id: r.user.id };
  };

  it('shows only today\'s slots of the rotating pool plus the fixed items, and says when it changes', async () => {
    const { app, store } = rotatingApp(3);
    const a = await login(app);
    store.give(a.id, 500);
    store.now.ms = Date.UTC(2026, 9, 5, 12);
    const shop = shopSchema.parse((await app.inject({ method: 'GET', url: '/shop', headers: a.h })).json());
    expect(shop.items.filter((i) => i.rotating)).toHaveLength(3);
    expect(shop.items.filter((i) => !i.rotating)).toHaveLength(1);
    expect(shop.rotatesAt).toBeGreaterThan(store.now.ms);
    expect(shop.rotatesAt! - store.now.ms).toBeLessThanOrEqual(86_400_000);
  });
  it('refuses an item that is not on today\'s offer', async () => {
    const { app, store } = rotatingApp(3);
    const a = await login(app);
    store.give(a.id, 500);
    store.now.ms = Date.UTC(2026, 9, 5, 12);
    const offered = new Set(shopSchema.parse((await app.inject({ method: 'GET', url: '/shop', headers: a.h })).json()).items.map((i) => i.id));
    const hidden = Array.from({ length: 9 }, (_, i) => `00000000-0000-7000-8000-${String(i + 1).padStart(12, '0')}`).find((id) => !offered.has(id))!;
    const res = await app.inject({ method: 'POST', url: `/shop/${hidden}/buy`, headers: a.h });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'not_today' });
  });
  it('offers every rotating item when slots is 0', async () => {
    const { app, store } = rotatingApp(0);
    const a = await login(app);
    expect(shopSchema.parse((await app.inject({ method: 'GET', url: '/shop', headers: a.h })).json()).items).toHaveLength(9);
    void store;
  });
});
