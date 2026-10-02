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
    expect(out).toMatchObject({ slice: 0, coins: DEFAULT_WHEEL_RULES.slices[0]!.coins, pending: 0 });
    expect(t.wheelStore.balances.get('a')).toBe(out!.coins);
    expect(await t.wheel.spin('a')).toBeNull();
  });
  it('does nothing while the admin has the wheel off', async () => {
    const t = boot({ ...DEFAULT_WHEEL_RULES, enabled: false });
    expect(await t.wheel.grantForWin('a', 'm1')).toBe(false);
    expect(await t.wheel.spin('a')).toBeNull();
    expect((await t.wheel.status('a')).enabled).toBe(false);
  });
});
