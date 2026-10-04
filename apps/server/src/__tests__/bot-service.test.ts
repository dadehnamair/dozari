import { describe, expect, it } from 'vitest';
import type { BotRepository, SourceRow } from '../bot/repository.js';
import { BotService, dedupeKeyOf } from '../bot/service.js';
import { startBotScheduler } from '../bot/scheduler.js';
import { SettingsService } from '../settings/service.js';
import { createMemorySettingsStore } from '../settings/db-store.js';

const html = '<table><tr><th>n</th><th>y</th><th>p</th></tr><tr><td>نان سنگک</td><td>۱۳۷۵</td><td>۵۰</td></tr><tr><td>شیر</td><td>۱۳۸۰</td><td>۱۲۰</td></tr></table>';

function memoryRepo(sources: SourceRow[]) {
  const keys = new Set<string>();
  const state = { runs: [] as { status: string; found: number; added: number; error?: string }[], candidates: [] as { name: string; status: string; url: string }[] };
  const repo = {
    listSources: async () => sources,
    getSource: async (id: string) => sources.find((s) => s.id === id) ?? null,
    markSourceRun: async (id: string, at: Date) => {
      const s = sources.find((x) => x.id === id);
      if (s) s.lastRunAt = at.getTime();
    },
    startRun: async () => 'run1',
    finishRun: async (_id: string, p: { status: string; foundCount: number; newCount: number; errorText?: string }) => {
      state.runs.push({ status: p.status, found: p.foundCount, added: p.newCount, error: p.errorText });
    },
    addCandidates: async (_run: string, source: SourceRow, items: { raw: { productNameFa: string }; dedupeKey: string }[]) => {
      let n = 0;
      for (const i of items) {
        if (keys.has(i.dedupeKey)) continue;
        keys.add(i.dedupeKey);
        state.candidates.push({ name: i.raw.productNameFa, status: 'pending', url: source.url });
        n++;
      }
      return n;
    },
  } as unknown as BotRepository;
  return { repo, state };
}

const source = (over: Partial<SourceRow> = {}): SourceRow => ({
  id: 's1', name: 'منبع آزمایشی', url: 'https://example.test/prices', adapter: 'html_table', sourceType: 'website', enabled: true, everyHours: 24, lastRunAt: null, notes: null,
  options: { name_col: '0', year_col: '1', price_col: '2' }, ...over,
});

describe('BotService', () => {
  it('stores what it finds as pending candidates with the source url, once', async () => {
    const { repo, state } = memoryRepo([source()]);
    const bot = new BotService(repo, async () => html);
    const first = await bot.runDue(100);
    expect(first[0]).toMatchObject({ status: 'ok', found: 2, added: 2 });
    expect(state.candidates.every((c) => c.status === 'pending' && c.url === 'https://example.test/prices')).toBe(true);
    // a second run with the same page adds nothing new
    const again = await bot.runOne('s1', 100);
    expect(again).toMatchObject({ status: 'ok', found: 2, added: 0 });
  });

  it('records a failed fetch without throwing and respects the per-run cap', async () => {
    const { repo, state } = memoryRepo([source()]);
    const failing = new BotService(repo, async () => {
      throw new Error('HTTP 503');
    });
    expect(await failing.runOne('s1', 100)).toMatchObject({ status: 'failed', error: 'HTTP 503' });
    expect(state.runs.at(-1)).toMatchObject({ status: 'failed', error: 'HTTP 503' });
    const capped = new BotService(memoryRepo([source()]).repo, async () => html);
    expect((await capped.runOne('s1', 1))?.added).toBe(1);
  });

  it('runs only enabled sources that are due', async () => {
    let t = 1_000_000_000_000;
    const { repo } = memoryRepo([source({ id: 'a' }), source({ id: 'b', enabled: false }), source({ id: 'c', lastRunAt: t - 3_600_000 })]);
    const bot = new BotService(repo, async () => html, () => t);
    expect((await bot.runDue(100)).map((r) => r.sourceId)).toEqual(['a']);
    t += 25 * 3_600_000;
    expect((await bot.runDue(100)).map((r) => r.sourceId).sort()).toEqual(['a', 'c']);
  });

  it('dedupe keys differ by price and url', () => {
    const c = { productNameFa: 'x', year: 1380, priceRials: 10n, excerpt: '' };
    expect(dedupeKeyOf(c, 'u1')).not.toBe(dedupeKeyOf(c, 'u2'));
    expect(dedupeKeyOf(c, 'u1')).not.toBe(dedupeKeyOf({ ...c, priceRials: 11n }, 'u1'));
  });
});

describe('scheduler', () => {
  it('runs due sources when enabled and stays quiet when switched off', async () => {
    const timers: (() => void)[] = [];
    const setTimer = ((fn: () => void) => {
      timers.push(fn);
      return 0;
    }) as unknown as typeof setTimeout;
    const { repo } = memoryRepo([source()]);
    const settings = new SettingsService(createMemorySettingsStore({ 'bot.enabled': '0' }));
    const logs: string[] = [];
    const handle = startBotScheduler({ bot: new BotService(repo, async () => html), settings, log: (m) => logs.push(m), setTimer });
    timers.shift()!();
    await new Promise((r) => setTimeout(r, 20));
    expect(logs).toEqual([]);
    await settings.set('bot.enabled', '1');
    timers.shift()!();
    await new Promise((r) => setTimeout(r, 20));
    expect(logs[0]).toContain('2 new candidate');
    handle.stop();
  });
});
