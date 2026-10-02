import { dailyDateKey, dateKeysFrom, isDateKey, pickDaily, shiftDateKey } from '@dozari/shared';
import type { DailyStatus } from '@dozari/shared';
import type { SoloService } from '../solo/service.js';
import type { SoloView } from '../solo/types.js';
import type { DailyRow, DailyStore, NewTheme, ThemeRow } from './store.js';

export interface DailyDeps {
  /** Reads one admin setting (SettingsService.num). */
  num: (key: string) => Promise<number>;
  now?: () => number;
}

export const DAILY_TAG_PREFIX = 'daily:';

/** The daily puzzle: one chosen puzzle per Tehran day, one attempt per player, a streak and a small reward. */
export class DailyService {
  private readonly now: () => number;

  constructor(
    private readonly store: DailyStore,
    private readonly solo: SoloService,
    private readonly deps: DailyDeps,
  ) {
    this.now = deps.now ?? Date.now;
  }

  /** Today's row, chosen on first need and then frozen (so every instance and player sees the same puzzle). */
  async ensure(dateKey: string): Promise<DailyRow | null> {
    const existing = await this.store.forDate(dateKey);
    if (existing) return existing;
    const picked = await this.pickFor(dateKey, new Set());
    if (!picked) return null;
    const row: DailyRow = { dateKey, puzzleId: picked.puzzleId, themeId: picked.themeId, pinnedBy: 'auto' };
    await this.store.setForDate(row);
    return (await this.store.forDate(dateKey)) ?? row;
  }

  private async pickFor(dateKey: string, extraRecent: ReadonlySet<string>) {
    const days = await this.deps.num('daily.repeat_days');
    const since = days > 0 ? shiftDateKey(dateKey, -days) : dateKey;
    const [themes, all, used] = await Promise.all([this.store.candidates(), this.store.allApprovedIds(), this.store.usedPuzzles(since, dateKey)]);
    return pickDaily({ dateKey, themes, allPuzzleIds: all, recentPuzzleIds: new Set([...used, ...extraRecent]) });
  }

  private async streakOf(userId: string, dateKey: string): Promise<number> {
    const won = new Set(await this.store.wonDays(userId, 70));
    // today counts when won; otherwise the streak is what ended yesterday
    let i = won.has(dateKey) ? 0 : 1;
    let n = 0;
    while (i < 70 && won.has(shiftDateKey(dateKey, -i))) {
      n++;
      i++;
    }
    return n;
  }

  async rewardFor(streak: number): Promise<number> {
    const [base, step, maxDays] = await Promise.all([this.deps.num('daily.reward_coins'), this.deps.num('daily.streak_step'), this.deps.num('daily.streak_max_days')]);
    return base + step * Math.max(0, Math.min(streak, maxDays) - 1);
  }

  async status(userId: string): Promise<DailyStatus> {
    const dateKey = dailyDateKey(this.now());
    const row = await this.ensure(dateKey);
    const streak = await this.streakOf(userId, dateKey);
    const rewardCoins = await this.rewardFor(streak + 1);
    if (!row) return { dateKey, themeTitleFa: null, state: 'unavailable', rewardCoins, streak };
    const [play, title] = await Promise.all([this.store.play(userId, dateKey), row.themeId ? this.store.titleOf(row.themeId) : Promise.resolve(null)]);
    return { dateKey, themeTitleFa: title, state: play ?? 'available', rewardCoins, streak };
  }

  /** Starts (or restarts, if the server lost the session) today's attempt. A finished attempt cannot be replayed. */
  async start(userId: string): Promise<{ ok: true; view: SoloView } | { ok: false; error: 'unavailable' | 'done' }> {
    const dateKey = dailyDateKey(this.now());
    const row = await this.ensure(dateKey);
    if (!row) return { ok: false, error: 'unavailable' };
    const created = await this.store.startPlay(userId, dateKey);
    if (!created && (await this.store.play(userId, dateKey)) !== 'playing') return { ok: false, error: 'done' };
    const view = await this.solo.start(userId, { puzzleId: row.puzzleId, tag: `${DAILY_TAG_PREFIX}${dateKey}` });
    if (!view) return { ok: false, error: 'unavailable' };
    return { ok: true, view };
  }

  /** Solo hook: a game tagged `daily:<date>` ended. */
  async onFinished(userId: string, outcome: 'win' | 'loss', tag?: string): Promise<void> {
    if (!tag?.startsWith(DAILY_TAG_PREFIX)) return;
    const dateKey = tag.slice(DAILY_TAG_PREFIX.length);
    if (!isDateKey(dateKey)) return;
    if (!(await this.store.finishPlay(userId, dateKey, outcome === 'win' ? 'won' : 'lost'))) return;
    if (outcome === 'win') await this.store.payReward(userId, dateKey, await this.rewardFor(await this.streakOf(userId, dateKey)));
  }

  // ---- admin ------------------------------------------------------------------------------------------------------

  async adminThemes(): Promise<(ThemeRow & { puzzles: number })[]> {
    const [themes, counts] = await Promise.all([this.store.themes(), this.store.linkCounts()]);
    return themes.map((t) => ({ ...t, puzzles: counts[t.id] ?? 0 }));
  }

  saveTheme(id: string | null, t: NewTheme) {
    return this.store.saveTheme(id, t);
  }

  deleteTheme(id: string) {
    return this.store.deleteTheme(id);
  }

  link(themeId: string, puzzleId: string, on: boolean) {
    return this.store.link(themeId, puzzleId, on);
  }

  puzzles(limit: number) {
    return this.store.puzzleSummaries(limit);
  }

  linked(themeId: string) {
    return this.store.linked(themeId);
  }

  async pin(dateKey: string, puzzleId: string, themeId: string | null) {
    if (!isDateKey(dateKey) || dateKey < dailyDateKey(this.now())) return 'bad_date' as const;
    if (!(await this.store.allApprovedIds()).includes(puzzleId)) return 'not_found' as const;
    return this.store.setForDate({ dateKey, puzzleId, themeId, pinnedBy: 'admin' });
  }

  unpin(dateKey: string) {
    return this.store.clearDate(dateKey);
  }

  /** Today and the next days: what is set, or what the picker would choose (preview, not saved). */
  async schedule(days: number): Promise<{ dateKey: string; puzzleId: string | null; themeId: string | null; pinnedBy: 'auto' | 'admin' | 'preview' }[]> {
    const keys = dateKeysFrom(dailyDateKey(this.now()), days);
    const rows = new Map((await this.store.range(keys[0]!, shiftDateKey(keys[keys.length - 1]!, 1))).map((r) => [r.dateKey, r]));
    const out: { dateKey: string; puzzleId: string | null; themeId: string | null; pinnedBy: 'auto' | 'admin' | 'preview' }[] = [];
    const seen = new Set<string>();
    for (const dateKey of keys) {
      const r = rows.get(dateKey);
      if (r) {
        seen.add(r.puzzleId);
        out.push({ dateKey, puzzleId: r.puzzleId, themeId: r.themeId, pinnedBy: r.pinnedBy });
        continue;
      }
      const p = await this.pickFor(dateKey, seen);
      if (p) seen.add(p.puzzleId);
      out.push({ dateKey, puzzleId: p?.puzzleId ?? null, themeId: p?.themeId ?? null, pinnedBy: 'preview' });
    }
    return out;
  }
}
