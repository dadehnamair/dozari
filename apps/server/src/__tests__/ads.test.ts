import { describe, expect, it } from 'vitest';
import { AdsService } from '../ads/service.js';
import { createMemoryAdsStore } from '../ads/store.js';

function boot(on = true) {
  const store = createMemoryAdsStore();
  let t = Date.UTC(2026, 9, 10, 8, 0);
  const ads = new AdsService(store, async () => on, () => t);
  return { store, ads, advance: (s: number) => (t += s * 1000) };
}

describe('rewarded ads', () => {
  it('offers nothing while everything is off (the default)', async () => {
    const t = boot();
    expect((await t.ads.status('u')).offers).toEqual([]);
    expect(await t.ads.start('u', 'coins_short')).toEqual({ ok: false, error: 'disabled' });
  });

  it('offers nothing when the global switch is off even if a placement is on', async () => {
    const t = boot(false);
    await t.ads.placements.update('coins_short', { enabled: true });
    expect(await t.ads.status('u')).toEqual({ enabled: false, offers: [] });
    expect(await t.ads.start('u', 'coins_short')).toEqual({ ok: false, error: 'disabled' });
  });

  it('pays the placement reward once, only after the minimum watch time', async () => {
    const t = boot();
    await t.ads.placements.update('coins_short', { enabled: true, rewardAmount: 40, minWatchSeconds: 10 });
    const s = await t.ads.start('u', 'coins_short');
    if (!s.ok) throw new Error('start');
    expect((await t.ads.complete('u', s.viewId)).ok).toBe(false);
    t.advance(11);
    const done = await t.ads.complete('u', s.viewId);
    expect(done).toMatchObject({ ok: true, paid: { rewardKind: 'coins', rewardAmount: 40, balance: 40 } });
    expect(await t.ads.complete('u', s.viewId)).toEqual({ ok: false, error: 'already' });
    expect(t.store.balances.get('u')).toBe(40);
  });

  it('refuses another player, an unknown id and a stale view', async () => {
    const t = boot();
    await t.ads.placements.update('coins_short', { enabled: true });
    const s = await t.ads.start('u', 'coins_short');
    if (!s.ok) throw new Error('start');
    t.advance(15);
    expect(await t.ads.complete('other', s.viewId)).toEqual({ ok: false, error: 'not_found' });
    expect(await t.ads.complete('u', 'nope')).toEqual({ ok: false, error: 'not_found' });
    t.advance(700);
    expect(await t.ads.complete('u', s.viewId)).toEqual({ ok: false, error: 'expired' });
  });

  it('enforces the cooldown and the daily cap, and shows what is left', async () => {
    const t = boot();
    await t.ads.placements.update('coins_short', { enabled: true, dailyCap: 2, cooldownSeconds: 60, minWatchSeconds: 5 });
    const watch = async () => {
      const s = await t.ads.start('u', 'coins_short');
      if (!s.ok) return s;
      t.advance(6);
      await t.ads.complete('u', s.viewId);
      return s;
    };
    expect((await watch()).ok).toBe(true);
    expect(await t.ads.start('u', 'coins_short')).toEqual({ ok: false, error: 'cooldown' });
    expect((await t.ads.status('u')).offers[0]).toMatchObject({ placement: 'coins_short', leftToday: 1 });
    t.advance(60);
    expect((await watch()).ok).toBe(true);
    t.advance(120);
    expect(await t.ads.start('u', 'coins_short')).toEqual({ ok: false, error: 'capped' });
    expect((await t.ads.status('u')).offers).toEqual([]);
  });

  it('pays the other reward kinds', async () => {
    const t = boot();
    await t.ads.placements.update('wheel_extra', { enabled: true, rewardKind: 'wheel_spin', rewardAmount: 1, minWatchSeconds: 1 });
    await t.ads.placements.update('coin_shop', { enabled: true, rewardKind: 'gems', rewardAmount: 3, minWatchSeconds: 1 });
    for (const p of ['wheel_extra', 'coin_shop'] as const) {
      const s = await t.ads.start('u', p);
      if (!s.ok) throw new Error('start');
      t.advance(2);
      await t.ads.complete('u', s.viewId);
    }
    expect(t.store.spins.get('u')).toBe(1);
    expect(t.store.gemBalances.get('u')).toBe(3);
  });
});
