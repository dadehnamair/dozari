import { describe, expect, it } from 'vitest';
import { PRICE_GUESS_MIN_POINTS, PRICE_GUESS_STAIRCASE } from '@dozari/shared';
import { DailyService } from '../daily/service.js';
import { createMemoryDailyStore } from '../daily/store.js';
import { SoloService } from '../solo/service.js';
import type { ServedPuzzle } from '../solo/types.js';

const mk = (id: string): ServedPuzzle => ({
  id,
  groups: ([0, 1, 2, 3] as const).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `${id}g${level}p${i}`), titleFa: `عنوان ${level}`, explanationFa: 'e' })),
  items: Object.fromEntries([0, 1, 2, 3].flatMap((l) => [0, 1, 2, 3].map((i) => [`${id}g${l}p${i}`, { nameFa: 'x', unitFa: null }]))),
});
const puzzles = new Map(['p1', 'p2', 'p3'].map((id) => [id, mk(id)]));
const U = '00000000-0000-7000-8000-000000000001';
const DAY = Date.UTC(2026, 9, 2, 8); // 2026-10-02 in Tehran

function boot(opts: { now?: { ms: number }; maxMistakes?: number } = {}) {
  const clock = opts.now ?? { ms: DAY };
  const store = createMemoryDailyStore(['p1', 'p2', 'p3']);
  let daily!: DailyService;
  const solo = new SoloService(
    { pickRandom: async () => puzzles.get('p1')!, byId: async (id) => puzzles.get(id) ?? null, pricesFor: async () => ({}) },
    { rules: async () => ({ maxMistakes: opts.maxMistakes ?? 4, tiers: PRICE_GUESS_STAIRCASE, minPoints: PRICE_GUESS_MIN_POINTS }), onFinished: (id, o, tag) => void daily.onFinished(id, o, tag) },
  );
  const nums: Record<string, number> = { 'daily.reward_coins': 20, 'daily.streak_step': 5, 'daily.streak_max_days': 7, 'daily.repeat_days': 30 };
  daily = new DailyService(store, solo, { num: async (k) => nums[k]!, now: () => clock.ms });
  return { store, solo, daily, clock };
}

async function winAll(solo: SoloService, sessionId: string, p: ServedPuzzle) {
  for (const g of p.groups) solo.guess(sessionId, [...g.productIds]);
  await new Promise((r) => setTimeout(r, 5));
}

describe('daily puzzle', () => {
  it('freezes one puzzle per day and shows the same one to everyone', async () => {
    const { daily, store } = boot();
    const a = await daily.ensure('2026-10-02');
    expect(a).not.toBeNull();
    expect(await daily.ensure('2026-10-02')).toEqual(a);
    expect((await store.forDate('2026-10-02'))?.pinnedBy).toBe('auto');
  });

  it('reports availability, then pays once for a win and refuses a replay', async () => {
    const { daily, solo, store } = boot();
    expect((await daily.status(U)).state).toBe('available');
    const started = await daily.start(U);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect((await daily.status(U)).state).toBe('playing');
    const row = (await store.forDate('2026-10-02'))!;
    await winAll(solo, started.view.sessionId, puzzles.get(row.puzzleId)!);
    expect((await daily.status(U)).state).toBe('won');
    expect(store.paid).toEqual([{ userId: U, dateKey: '2026-10-02', coins: 20 }]);
    expect(await daily.start(U)).toEqual({ ok: false, error: 'done' });
  });

  it('a lost attempt pays nothing and cannot be retried', async () => {
    const { daily, solo, store } = boot({ maxMistakes: 1 });
    const started = await daily.start(U);
    if (!started.ok) throw new Error('start');
    const p = puzzles.get((await store.forDate('2026-10-02'))!.puzzleId)!;
    solo.guess(started.view.sessionId, [p.groups[0]!.productIds[0]!, p.groups[0]!.productIds[1]!, p.groups[1]!.productIds[0]!, p.groups[2]!.productIds[0]!]);
    await new Promise((r) => setTimeout(r, 5));
    expect((await daily.status(U)).state).toBe('lost');
    expect(store.paid).toEqual([]);
    expect(await daily.start(U)).toEqual({ ok: false, error: 'done' });
  });

  it('grows the reward with the win streak and breaks it on a missed day', async () => {
    const clock = { ms: DAY };
    const { daily, solo, store } = boot({ now: clock });
    const play = async () => {
      const s = await daily.start(U);
      if (!s.ok) throw new Error('start');
      const key = (await daily.status(U)).dateKey;
      await winAll(solo, s.view.sessionId, puzzles.get((await store.forDate(key))!.puzzleId)!);
    };
    await play();
    clock.ms += 86_400_000;
    await play();
    clock.ms += 86_400_000;
    await play();
    expect(store.paid.map((p) => p.coins)).toEqual([20, 25, 30]);
    clock.ms += 2 * 86_400_000; // skip a day
    expect((await daily.status(U)).streak).toBe(0);
    expect((await daily.status(U)).rewardCoins).toBe(20);
  });

  it('an admin pin wins over the picker until someone has played it', async () => {
    const { daily, store } = boot();
    expect(await daily.pin('2026-10-02', 'p3', null)).toBe('ok');
    expect((await daily.ensure('2026-10-02'))?.puzzleId).toBe('p3');
    await daily.start(U);
    expect(await daily.pin('2026-10-02', 'p2', null)).toBe('played');
    expect(await daily.pin('2026-10-01', 'p2', null)).toBe('bad_date');
    expect(await daily.pin('2026-10-05', 'nope', null)).toBe('not_found');
    expect(await store.forDate('2026-10-02')).toMatchObject({ puzzleId: 'p3', pinnedBy: 'admin' });
  });

  it('prefers a themed puzzle on the theme days and previews the schedule', async () => {
    const { daily } = boot();
    const t = await daily.saveTheme(null, { titleFa: 'همیشه', kind: 'trend', weight: 1, startMonth: null, startDay: null, endMonth: null, endDay: null, fromDate: null, toDate: null, isActive: true });
    await daily.link(t!.id, 'p2', true);
    const status = await daily.status(U);
    expect(status.themeTitleFa).toBe('همیشه');
    const days = await daily.schedule(5);
    expect(days).toHaveLength(5);
    expect(days[0]).toMatchObject({ dateKey: '2026-10-02', pinnedBy: 'auto', themeId: t!.id });
    expect(new Set(days.map((d) => d.puzzleId)).size).toBeGreaterThan(1);
  });
});
