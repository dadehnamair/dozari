import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@dozari/shared';
import type { CatalogProduct } from '@dozari/shared';
import { createMemoryPuzzleAdmin } from '../puzzles/admin.js';
import { startPuzzlePoolScheduler, topUpPuzzlePool } from '../puzzles/pool.js';
import type { SettingsService } from '../settings/service.js';

const YEARS = [1365, 1370, 1375, 1380, 1385, 1390, 1395, 1400];
function richCatalog(): CatalogProduct[] {
  const rng = mulberry32(11);
  return Array.from({ length: 150 }, (_, i) => {
    let price = Math.floor(10 ** (1 + rng() * 3));
    const prices = YEARS.map((year) => {
      const row = { year, month: null, priceRials: BigInt(price) };
      price = Math.floor(price * (1.5 + rng() * 5));
      return row;
    });
    return { id: `00000000-0000-7000-7000-${String(i + 1).padStart(12, '0')}`, category: ['food', 'snack', 'drink', 'car', 'electronics'][i % 5] as string, eraTags: i % 3 === 0 ? ['dahe-60'] : [], prices };
  });
}
const boot = (catalog = richCatalog()) => createMemoryPuzzleAdmin(new Set(catalog.map((p) => p.id)), catalog);

describe('topUpPuzzlePool', () => {
  it('fills the draft backlog up to the target and then stops', async () => {
    const admin = boot();
    const first = await topUpPuzzlePool(admin, { enabled: true, target: 3, autoApprove: false }, mulberry32(1));
    expect(first).toMatchObject({ have: 0, created: 3, approved: 0 });
    expect(await admin.counts()).toEqual({ draft: 3, approved: 0 });
    expect(await topUpPuzzlePool(admin, { enabled: true, target: 3, autoApprove: false }, mulberry32(2))).toEqual({ have: 3, created: 0, approved: 0 });
    expect((await topUpPuzzlePool(admin, { enabled: true, target: 5, autoApprove: false }, mulberry32(3))).created).toBe(2);
  });

  it('does nothing when off, and nothing when the catalog is too small', async () => {
    expect(await topUpPuzzlePool(boot(), { enabled: false, target: 3, autoApprove: false }, mulberry32(1))).toMatchObject({ created: 0 });
    expect(await topUpPuzzlePool(boot([]), { enabled: true, target: 3, autoApprove: false }, mulberry32(1))).toMatchObject({ created: 0 });
  });

  it('publishes straight away only when auto-approve is on, and counts live puzzles then', async () => {
    const admin = boot();
    const out = await topUpPuzzlePool(admin, { enabled: true, target: 2, autoApprove: true }, mulberry32(1));
    expect(out).toMatchObject({ created: 2, approved: 2 });
    expect(await admin.counts()).toEqual({ draft: 0, approved: 2 });
    expect((await topUpPuzzlePool(admin, { enabled: true, target: 2, autoApprove: true }, mulberry32(2))).created).toBe(0);
  });

  it('the scheduler reads the settings, runs once after boot and re-arms with the setting', async () => {
    const admin = boot();
    const values: Record<string, number> = { 'puzzles.autofill_enabled': 1, 'puzzles.autofill_target': 2, 'puzzles.autofill_check_minutes': 15, 'puzzles.autofill_auto_approve': 0 };
    const settings = { num: async (k: string) => values[k] } as unknown as SettingsService;
    const timers: { ms: number; fn: () => void }[] = [];
    const logs: string[] = [];
    const handle = startPuzzlePoolScheduler({ admin, settings, rng: mulberry32(4), log: (m) => logs.push(m), setTimer: ((fn: () => void, ms: number) => (timers.push({ ms, fn }), 0)) as unknown as typeof setTimeout });
    timers[0]!.fn();
    await new Promise((r) => setTimeout(r, 10));
    expect(await admin.counts()).toEqual({ draft: 2, approved: 0 });
    expect(logs[0]).toContain('made 2');
    expect(timers[1]!.ms).toBe(15 * 60_000);
    handle.stop();
  });
});
