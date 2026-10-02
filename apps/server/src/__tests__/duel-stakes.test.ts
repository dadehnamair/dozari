import { describe, expect, it } from 'vitest';
import { DuelStakes } from '../duel/stakes.js';
import { createMemoryStakeStore } from '../duel/stakes-store.js';
import type { DuelRules } from '@dozari/shared';

const rules: DuelRules = { entryFee: 20, houseCutPercent: 10, freePerDay: 1, freePayoutPercent: 50, consolation: 5, consolationCap: 10, rescueTarget: 60 };

function boot(bots: string[] = []) {
  const store = createMemoryStakeStore();
  const stakes = new DuelStakes(store, { rules: async () => rules, isBot: (id) => bots.includes(id), now: () => store.clock.ms });
  return { store, stakes };
}
const M = 'match-1';

describe('duel stakes', () => {
  it('uses the daily free match first, then charges the entry fee', async () => {
    const t = boot();
    t.store.balances.set('a', 100);
    t.store.balances.set('b', 100);
    expect(await t.stakes.open('m1', ['a', 'b'])).toEqual(['free', 'free']);
    expect(t.store.balances.get('a')).toBe(100);
    expect(await t.stakes.open('m2', ['a', 'b'])).toEqual(['paid', 'paid']);
    expect(t.store.balances.get('a')).toBe(80);
  });
  it('pays the winner the pot minus the cut and the loser a capped consolation, once', async () => {
    const t = boot();
    t.store.balances.set('a', 100);
    t.store.balances.set('b', 100);
    await t.stakes.open('m1', ['a', 'b']); // free
    const s = (await t.stakes.open(M, ['a', 'b']))!;
    await t.stakes.settle(M, ['a', 'b'], s, { winner: 0, reason: 'solved' });
    await t.stakes.settle(M, ['a', 'b'], s, { winner: 0, reason: 'solved' }); // replay is a no-op
    expect(t.store.balances.get('a')).toBe(100 - 20 + 36);
    expect(t.store.balances.get('b')).toBe(100 - 20 + 5);
  });
  it('covers a bot seat for the house and pays nothing when the bot wins', async () => {
    const t = boot(['bot']);
    t.store.balances.set('a', 100);
    await t.stakes.open('m1', ['a', 'bot']); // free
    const s = (await t.stakes.open(M, ['a', 'bot']))!;
    expect(s).toEqual(['paid', 'house']);
    await t.stakes.settle(M, ['a', 'bot'], s, { winner: 1, reason: 'solved' });
    expect(t.store.balances.get('a')).toBe(100 - 20 + 5);
    expect(t.store.balances.has('bot')).toBe(false);
  });
  it('returns a taken fee when the other player cannot pay', async () => {
    const t = boot();
    t.store.balances.set('a', 100);
    t.store.balances.set('b', 5);
    await t.stakes.open('f1', ['a', 'b']); // free for both
    expect(await t.stakes.open(M, ['a', 'b'])).toBeNull();
    expect(t.store.balances.get('a')).toBe(100);
  });
  it('rescues a broke player once a day and then refuses', async () => {
    const t = boot();
    t.store.balances.set('a', 3);
    await t.store.bumpFree('a', '2026-10-02'); // free match used up
    expect(await t.stakes.canQueue('a')).toBe(true);
    expect(t.store.balances.get('a')).toBe(60);
    t.store.balances.set('a', 0);
    expect(await t.stakes.canQueue('a')).toBe(false);
  });
  it('gives no consolation to an abandoner and refunds a draw minus the cut', async () => {
    const t = boot();
    t.store.balances.set('a', 100);
    t.store.balances.set('b', 100);
    await t.stakes.open('f', ['a', 'b']);
    const s = (await t.stakes.open(M, ['a', 'b']))!;
    await t.stakes.settle(M, ['a', 'b'], s, { winner: 0, reason: 'abandon' });
    expect(t.store.balances.get('b')).toBe(80);
    const s2 = (await t.stakes.open('m3', ['a', 'b']))!;
    await t.stakes.settle('m3', ['a', 'b'], s2, { winner: null, reason: 'solved' });
    expect(t.store.balances.get('b')).toBe(80 - 20 + 18);
  });
});
