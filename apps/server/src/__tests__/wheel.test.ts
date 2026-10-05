import { describe, expect, it } from 'vitest';
import { DEFAULT_WHEEL_RULES } from '@dozari/shared';
import type { DuelRules, WheelRules } from '@dozari/shared';
import { DuelStakes } from '../duel/stakes.js';
import { createMemoryStakeStore } from '../duel/stakes-store.js';
import { WheelService } from '../wheel/service.js';
import { createMemoryWheelStore } from '../wheel/store.js';

const duel: DuelRules = { entryFee: 20, houseCutPercent: 10, freePerDay: 0, freePayoutPercent: 50, consolation: 5, consolationCap: 10, rescueTarget: 60 };

function boot(rules: WheelRules = DEFAULT_WHEEL_RULES, bots: string[] = []) {
  const wheelStore = createMemoryWheelStore();
  const wheel = new WheelService(wheelStore, async () => rules, () => 0);
  const store = createMemoryStakeStore();
  store.balances.set('a', 100);
  store.balances.set('b', 100);
  const stakes = new DuelStakes(store, { rules: async () => duel, isBot: (id) => bots.includes(id), onWin: (m, u) => wheel.grantForWin(u, m) });
  return { wheel, wheelStore, stakes };
}

describe('lucky wheel', () => {
  it('gives only the winner of a duel one spin, once', async () => {
    const t = boot();
    const s = (await t.stakes.open('m1', ['a', 'b']))!;
    await t.stakes.settle('m1', ['a', 'b'], s, { winner: 0, reason: 'solved' });
    await t.stakes.settle('m1', ['a', 'b'], s, { winner: 0, reason: 'solved' });
    expect((await t.wheel.status('a')).pending).toBe(1);
    expect((await t.wheel.status('b')).pending).toBe(0);
  });
  it('gives nothing for a loss-side, draw, abandon or a bot opponent', async () => {
    const t = boot(DEFAULT_WHEEL_RULES, ['bot']);
    const s = (await t.stakes.open('m1', ['a', 'b']))!;
    await t.stakes.settle('m1', ['a', 'b'], s, { winner: null, reason: 'solved' });
    const s2 = (await t.stakes.open('m2', ['a', 'b']))!;
    await t.stakes.settle('m2', ['a', 'b'], s2, { winner: 0, reason: 'abandon' });
    const s3 = (await t.stakes.open('m3', ['a', 'bot']))!;
    await t.stakes.settle('m3', ['a', 'bot'], s3, { winner: 0, reason: 'solved' });
    expect((await t.wheel.status('a')).pending).toBe(0);
  });
  it('spins the prize into the balance and uses up the spin', async () => {
    const t = boot();
    await t.wheel.grantForWin('a', 'm1');
    const out = await t.wheel.spin('a');
    expect(out).toMatchObject({ slice: 0, kind: 'coins', amount: DEFAULT_WHEEL_RULES.slices[0]!.amount, pending: 0 });
    expect(t.wheelStore.balances.get('a')).toBe(out!.amount);
    expect(await t.wheel.spin('a')).toBeNull();
  });
  it('does nothing while the admin has the wheel off', async () => {
    const t = boot({ ...DEFAULT_WHEEL_RULES, enabled: false });
    expect(await t.wheel.grantForWin('a', 'm1')).toBe(false);
    expect(await t.wheel.spin('a')).toBeNull();
    expect((await t.wheel.status('a')).enabled).toBe(false);
  });
});

describe('spins that refill like lives', () => {
  it('gives one spin per window while fewer than the cap wait, and nothing when it is off', async () => {
    let clock = Date.UTC(2026, 9, 3, 12);
    const store = createMemoryWheelStore();
    const wheel = new WheelService(store, async () => ({ ...DEFAULT_WHEEL_RULES, refillHours: 6, refillCap: 2 }), () => 0, () => clock);
    expect((await wheel.status('a')).pending).toBe(1);
    expect((await wheel.status('a')).pending).toBe(1); // same window: nothing more
    clock += 6 * 3_600_000;
    expect((await wheel.status('a')).pending).toBe(2);
    clock += 6 * 3_600_000;
    expect((await wheel.status('a')).pending).toBe(2); // at the cap
    const off = new WheelService(createMemoryWheelStore(), async () => ({ ...DEFAULT_WHEEL_RULES, refillHours: 0 }), () => 0, () => clock);
    expect((await off.status('a')).pending).toBe(0);
  });
});

describe('typed prizes', () => {
  const spinWith = async (prize: { kind: 'coins' | 'gems' | 'hint_token' | 'wheel_spin'; amount: number }) => {
    const store = createMemoryWheelStore();
    const wheel = new WheelService(store, async () => ({ ...DEFAULT_WHEEL_RULES, slices: [{ ...prize, weight: 1 }] }), () => 0);
    await wheel.give('a', 'admin', 'x', 1);
    return { store, wheel, out: await wheel.spin('a') };
  };
  it('pays gems into the gem balance, not the coins', async () => {
    const { store, out } = await spinWith({ kind: 'gems', amount: 3 });
    expect(out).toMatchObject({ kind: 'gems', amount: 3, gems: 3, balance: 0 });
    expect(store.gemBalances.get('a')).toBe(3);
    expect(store.balances.get('a')).toBeUndefined();
  });
  it('gives hint tokens and extra spins', async () => {
    const t = await spinWith({ kind: 'hint_token', amount: 2 });
    expect(t.store.tokens.get('a')).toBe(2);
    const s = await spinWith({ kind: 'wheel_spin', amount: 2 });
    expect(s.out).toMatchObject({ kind: 'wheel_spin', pending: 2 });
  });
  it('a cosmetic prize is kept once; a repeat pays coins instead', async () => {
    const store = createMemoryWheelStore();
    const slices = [{ kind: 'cosmetic' as const, amount: 1, weight: 1, itemId: 'hat-1', iconKey: 'hat', titleFa: 'کلاه' }];
    const wheel = new WheelService(store, async () => ({ ...DEFAULT_WHEEL_RULES, slices, dupeCoins: 50 }), () => 0);
    await wheel.give('a', 'admin', 'x', 2);
    expect(await wheel.spin('a')).toMatchObject({ kind: 'cosmetic', titleFa: 'کلاه', iconKey: 'hat', duplicate: false });
    expect(store.wardrobe.get('a')?.has('hat-1')).toBe(true);
    expect(await wheel.spin('a')).toMatchObject({ kind: 'coins', amount: 50, duplicate: true, balance: 50 });
  });
  it('the status shows each slice with its kind', async () => {
    const t = boot();
    expect((await t.wheel.status('a')).slices[1]).toMatchObject({ kind: 'hint_token', amount: 1 });
  });
  it('a duel win gives no spin when the admin has win spins off', async () => {
    const t = boot({ ...DEFAULT_WHEEL_RULES, winSpins: false });
    expect(await t.wheel.grantForWin('a', 'm1')).toBe(false);
    expect((await t.wheel.status('a')).pending).toBe(0);
  });
});

describe('spins from outside a duel', () => {
  it('gives a bought, prize or admin spin once per ref, even with the wheel off', async () => {
    const t = boot({ ...DEFAULT_WHEEL_RULES, enabled: false });
    expect(await t.wheel.give('a', 'shop', 'buy-1', 3)).toBe(3);
    expect(await t.wheel.give('a', 'shop', 'buy-1', 3)).toBe(0);
    expect(await t.wheel.give('a', 'level', '5', 0)).toBe(0);
    const on = boot();
    await on.wheel.give('a', 'tournament', 't1', 2);
    expect((await on.wheel.status('a')).pending).toBe(2);
  });

  it('hands out the free daily spin once a day and never when it is off', async () => {
    let clock = Date.UTC(2026, 9, 3, 12);
    const store = createMemoryWheelStore();
    const wheel = new WheelService(store, async () => ({ ...DEFAULT_WHEEL_RULES, dailySpins: 2 }), () => 0, () => clock);
    const first = await wheel.status('a');
    expect([first.daily, first.pending]).toEqual([2, 2]);
    const again = await wheel.status('a');
    expect([again.daily, again.pending]).toEqual([0, 2]);
    clock += 24 * 3_600_000;
    const next = await wheel.status('a');
    expect([next.daily, next.pending]).toEqual([2, 4]);
    const off = new WheelService(createMemoryWheelStore(), async () => ({ ...DEFAULT_WHEEL_RULES, dailySpins: 0 }), () => 0);
    expect((await off.status('a')).pending).toBe(0);
  });
});
