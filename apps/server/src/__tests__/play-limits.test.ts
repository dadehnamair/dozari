import { describe, expect, it } from 'vitest';
import { PlayLimiter, createMemoryPlayCountStore } from '../limits/play-limits.js';

describe('PlayLimiter', () => {
  it('is unlimited at cap 0', async () => {
    const l = new PlayLimiter(createMemoryPlayCountStore(), async () => 0);
    for (let i = 0; i < 5; i++) await l.record('u', 'solo');
    expect(await l.check('u', 'solo')).toEqual({ ok: true, left: null });
  });
  it('refuses once the cap is used, per mode and per player', async () => {
    const l = new PlayLimiter(createMemoryPlayCountStore(), async (m) => (m === 'solo' ? 2 : 0));
    await l.record('u', 'solo');
    expect(await l.check('u', 'solo')).toEqual({ ok: true, left: 1 });
    await l.record('u', 'solo');
    expect(await l.check('u', 'solo')).toEqual({ ok: false, cap: 2 });
    expect((await l.check('other', 'solo')).ok).toBe(true);
    expect((await l.check('u', 'duel')).ok).toBe(true);
  });
  it('resets on the next Tehran day', async () => {
    let now = Date.UTC(2026, 9, 2, 10);
    const l = new PlayLimiter(createMemoryPlayCountStore(), async () => 1, () => now);
    await l.record('u', 'solo');
    expect((await l.check('u', 'solo')).ok).toBe(false);
    now += 24 * 3_600_000;
    expect((await l.check('u', 'solo')).ok).toBe(true);
  });
});
