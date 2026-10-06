import { describe, expect, it } from 'vitest';
import { DuelQueue } from '../realtime/queue.js';
import { DuelStakes } from '../duel/stakes.js';
import { createMemoryStakeStore } from '../duel/stakes-store.js';
import type { DuelRules, DuelTier } from '@dozari/shared';

describe('DuelQueue stake tiers', () => {
  it('never pairs players of different tables', () => {
    const q = new DuelQueue();
    q.join('b1', 1, 'adult', 'bronze');
    q.join('g1', 2, 'adult', 'gold');
    expect(q.takePair()).toBeNull();
    q.join('g2', 3, 'adult', 'gold');
    expect(q.takePairWithTier()).toEqual({ pair: ['g1', 'g2'], tier: 'gold' });
    expect(q.has('b1')).toBe(true);
  });
  it('defaults to bronze and keeps the tier in the waiting list', () => {
    const q = new DuelQueue();
    q.join('a', 1);
    q.join('s', 2, 'adult', 'silver');
    expect(q.waiting().map((w) => w.tier)).toEqual(['bronze', 'silver']);
  });
});

const rules: DuelRules = { entryFee: 20, houseCutPercent: 10, freePerDay: 3, freePayoutPercent: 50, consolation: 5, consolationCap: 10, rescueTarget: 60 };
const tiers: DuelTier[] = [
  { id: 'bronze', fee: 20, minLevel: 3 },
  { id: 'silver', fee: 100, minLevel: 8 },
  { id: 'gold', fee: 500, minLevel: 15 },
];
function boot() {
  const store = createMemoryStakeStore();
  const stakes = new DuelStakes(store, { rules: async () => rules, tiers: async () => tiers, isBot: () => false, now: () => store.clock.ms });
  return { store, stakes };
}

describe('DuelStakes tables', () => {
  it('charges the table fee, skips the free daily match and pays the pot minus the cut', async () => {
    const t = boot();
    t.store.balances.set('a', 1000);
    t.store.balances.set('b', 1000);
    const s = (await t.stakes.open('m1', ['a', 'b'], 'silver'))!;
    expect(s).toEqual(['paid', 'paid']);
    expect(t.store.balances.get('a')).toBe(900);
    await t.stakes.settle('m1', ['a', 'b'], s, { winner: 0, reason: 'solved' }, 'silver');
    expect(t.store.balances.get('a')).toBe(900 + 180);
    expect(t.store.balances.get('b')).toBe(900 + 5);
  });
  it('refuses a higher table without the fee and gives no rescue there', async () => {
    const t = boot();
    t.store.balances.set('a', 99);
    expect(await t.stakes.canQueue('a', 'silver')).toBe(false);
    t.store.balances.set('a', 100);
    expect(await t.stakes.canQueue('a', 'silver')).toBe(true);
  });
  it('returns the fees of the table when a start is cancelled', async () => {
    const t = boot();
    t.store.balances.set('a', 600);
    t.store.balances.set('b', 600);
    const s = (await t.stakes.open('m1', ['a', 'b'], 'gold'))!;
    await t.stakes.cancel('m1', ['a', 'b'], s, 'gold');
    expect(t.store.balances.get('a')).toBe(600);
    expect(t.store.balances.get('b')).toBe(600);
  });
  it('treats an unknown table as bronze', async () => {
    const t = boot();
    expect((await t.stakes.rulesFor('platinum')).entryFee).toBe(20);
  });
});
