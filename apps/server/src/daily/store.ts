import { and, asc, desc, dailyPuzzlePlays, dailyPuzzles, eq, gte, inArray, lt, puzzleGroups, puzzleThemeLinks, puzzleThemes, puzzles, sql } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';
import type { DailyCandidates } from '@dozari/shared';
import { applyLedgerEntry } from '../economy/ledger.js';

export const THEME_KINDS = ['occasion', 'season', 'trend', 'category', 'custom'] as const;
export type ThemeKind = (typeof THEME_KINDS)[number];

export interface ThemeRow {
  id: string;
  titleFa: string;
  kind: ThemeKind;
  weight: number;
  startMonth: number | null;
  startDay: number | null;
  endMonth: number | null;
  endDay: number | null;
  fromDate: string | null;
  toDate: string | null;
  isActive: boolean;
}
export type NewTheme = Omit<ThemeRow, 'id'>;

export interface DailyRow {
  dateKey: string;
  puzzleId: string;
  themeId: string | null;
  pinnedBy: 'auto' | 'admin';
}
export type PlayResult = 'playing' | 'won' | 'lost';

/** I/O boundary of the daily puzzle (docs/logic/daily-puzzle.md). */
export interface DailyStore {
  themes(): Promise<ThemeRow[]>;
  /** Active themes with their approved linked puzzles. */
  candidates(): Promise<DailyCandidates[]>;
  linkCounts(): Promise<Record<string, number>>;
  saveTheme(id: string | null, t: NewTheme): Promise<ThemeRow | null>;
  deleteTheme(id: string): Promise<boolean>;
  link(themeId: string, puzzleId: string, on: boolean): Promise<'ok' | 'not_found'>;
  linked(themeId: string): Promise<string[]>;
  allApprovedIds(): Promise<string[]>;
  forDate(dateKey: string): Promise<DailyRow | null>;
  /** Writes a day's row. `auto` never replaces an existing one; `admin` does (until someone has played it). */
  setForDate(row: DailyRow): Promise<'ok' | 'exists' | 'played'>;
  clearDate(dateKey: string): Promise<'ok' | 'played'>;
  range(fromKey: string, toKey: string): Promise<DailyRow[]>;
  /** Puzzle ids used on days in [fromKey, toKey). */
  usedPuzzles(fromKey: string, toKey: string): Promise<Set<string>>;
  play(userId: string, dateKey: string): Promise<PlayResult | null>;
  /** True when this call created the attempt. */
  startPlay(userId: string, dateKey: string): Promise<boolean>;
  /** True when the attempt moved from playing to the result. */
  finishPlay(userId: string, dateKey: string, result: 'won' | 'lost'): Promise<boolean>;
  /** Won day keys, newest first (at most `limit`). */
  wonDays(userId: string, limit: number): Promise<string[]>;
  payReward(userId: string, dateKey: string, coins: number): Promise<void>;
  titleOf(themeId: string): Promise<string | null>;
  /** Approved puzzles with their group titles, for the admin pickers. */
  puzzleSummaries(limit: number): Promise<{ id: string; titles: string[] }[]>;
}

export function createDbDailyStore(db: Db): DailyStore {
  const toTheme = (r: typeof puzzleThemes.$inferSelect): ThemeRow => ({
    id: r.id, titleFa: r.titleFa, kind: r.kind, weight: r.weight, startMonth: r.startMonth, startDay: r.startDay, endMonth: r.endMonth, endDay: r.endDay, fromDate: r.fromDate, toDate: r.toDate, isActive: r.isActive,
  });
  const toDaily = (r: typeof dailyPuzzles.$inferSelect): DailyRow => ({ dateKey: r.dateKey, puzzleId: r.puzzleId, themeId: r.themeId, pinnedBy: r.pinnedBy });
  const played = async (dateKey: string) => {
    const [r] = await db.select({ n: sql<number>`COUNT(*)` }).from(dailyPuzzlePlays).where(eq(dailyPuzzlePlays.dateKey, dateKey));
    return Number(r?.n ?? 0) > 0;
  };
  return {
    async themes() {
      return (await db.select().from(puzzleThemes).orderBy(desc(puzzleThemes.createdAt))).map(toTheme);
    },
    async candidates() {
      const themes = await db.select().from(puzzleThemes).where(eq(puzzleThemes.isActive, true));
      if (themes.length === 0) return [];
      const links = await db
        .select({ themeId: puzzleThemeLinks.themeId, puzzleId: puzzleThemeLinks.puzzleId })
        .from(puzzleThemeLinks)
        .innerJoin(puzzles, eq(puzzles.id, puzzleThemeLinks.puzzleId))
        .where(and(inArray(puzzleThemeLinks.themeId, themes.map((t) => t.id)), eq(puzzles.status, 'approved')));
      return themes.map((t) => ({ ...toTheme(t), puzzleIds: links.filter((l) => l.themeId === t.id).map((l) => l.puzzleId) }));
    },
    async linkCounts() {
      const rows = await db.select({ themeId: puzzleThemeLinks.themeId, n: sql<number>`COUNT(*)` }).from(puzzleThemeLinks).groupBy(puzzleThemeLinks.themeId);
      return Object.fromEntries(rows.map((r) => [r.themeId, Number(r.n)]));
    },
    async saveTheme(id, t) {
      if (!id) {
        const row = { id: uuidv7(), ...t };
        await db.insert(puzzleThemes).values(row);
        return row;
      }
      await db.update(puzzleThemes).set(t).where(eq(puzzleThemes.id, id));
      const [r] = await db.select().from(puzzleThemes).where(eq(puzzleThemes.id, id)).limit(1);
      return r ? toTheme(r) : null;
    },
    async deleteTheme(id) {
      const [r] = await db.select({ id: puzzleThemes.id }).from(puzzleThemes).where(eq(puzzleThemes.id, id)).limit(1);
      if (!r) return false;
      await db.delete(puzzleThemes).where(eq(puzzleThemes.id, id));
      return true;
    },
    async link(themeId, puzzleId, on) {
      const [p] = await db.select({ id: puzzles.id }).from(puzzles).where(eq(puzzles.id, puzzleId)).limit(1);
      const [t] = await db.select({ id: puzzleThemes.id }).from(puzzleThemes).where(eq(puzzleThemes.id, themeId)).limit(1);
      if (!p || !t) return 'not_found';
      if (on) await db.insert(puzzleThemeLinks).values({ themeId, puzzleId }).onDuplicateKeyUpdate({ set: { themeId } });
      else await db.delete(puzzleThemeLinks).where(and(eq(puzzleThemeLinks.themeId, themeId), eq(puzzleThemeLinks.puzzleId, puzzleId)));
      return 'ok';
    },
    async linked(themeId) {
      return (await db.select({ id: puzzleThemeLinks.puzzleId }).from(puzzleThemeLinks).where(eq(puzzleThemeLinks.themeId, themeId))).map((r) => r.id);
    },
    async allApprovedIds() {
      return (await db.select({ id: puzzles.id }).from(puzzles).where(eq(puzzles.status, 'approved'))).map((r) => r.id);
    },
    async forDate(dateKey) {
      const [r] = await db.select().from(dailyPuzzles).where(eq(dailyPuzzles.dateKey, dateKey)).limit(1);
      return r ? toDaily(r) : null;
    },
    async setForDate(row) {
      if (row.pinnedBy === 'auto') {
        await db.insert(dailyPuzzles).values(row).onDuplicateKeyUpdate({ set: { dateKey: row.dateKey } });
        const [r] = await db.select().from(dailyPuzzles).where(eq(dailyPuzzles.dateKey, row.dateKey)).limit(1);
        return r && r.puzzleId === row.puzzleId ? 'ok' : 'exists';
      }
      if (await played(row.dateKey)) return 'played';
      await db.insert(dailyPuzzles).values(row).onDuplicateKeyUpdate({ set: { puzzleId: row.puzzleId, themeId: row.themeId, pinnedBy: row.pinnedBy } });
      return 'ok';
    },
    async clearDate(dateKey) {
      if (await played(dateKey)) return 'played';
      await db.delete(dailyPuzzles).where(eq(dailyPuzzles.dateKey, dateKey));
      return 'ok';
    },
    async range(fromKey, toKey) {
      return (await db.select().from(dailyPuzzles).where(and(gte(dailyPuzzles.dateKey, fromKey), lt(dailyPuzzles.dateKey, toKey))).orderBy(dailyPuzzles.dateKey)).map(toDaily);
    },
    async usedPuzzles(fromKey, toKey) {
      const rows = await db.select({ id: dailyPuzzles.puzzleId }).from(dailyPuzzles).where(and(gte(dailyPuzzles.dateKey, fromKey), lt(dailyPuzzles.dateKey, toKey)));
      return new Set(rows.map((r) => r.id));
    },
    async play(userId, dateKey) {
      const [r] = await db.select({ result: dailyPuzzlePlays.result }).from(dailyPuzzlePlays).where(and(eq(dailyPuzzlePlays.userId, userId), eq(dailyPuzzlePlays.dateKey, dateKey))).limit(1);
      return r?.result ?? null;
    },
    async startPlay(userId, dateKey) {
      const [res] = await db.insert(dailyPuzzlePlays).ignore().values({ userId, dateKey });
      return res.affectedRows > 0;
    },
    async finishPlay(userId, dateKey, result) {
      const [res] = await db
        .update(dailyPuzzlePlays)
        .set({ result, finishedAt: new Date() })
        .where(and(eq(dailyPuzzlePlays.userId, userId), eq(dailyPuzzlePlays.dateKey, dateKey), eq(dailyPuzzlePlays.result, 'playing')));
      return res.affectedRows > 0;
    },
    async wonDays(userId, limit) {
      const rows = await db
        .select({ d: dailyPuzzlePlays.dateKey })
        .from(dailyPuzzlePlays)
        .where(and(eq(dailyPuzzlePlays.userId, userId), eq(dailyPuzzlePlays.result, 'won')))
        .orderBy(desc(dailyPuzzlePlays.dateKey))
        .limit(limit);
      return rows.map((r) => r.d);
    },
    async payReward(userId, dateKey, coins) {
      if (coins <= 0) return;
      await db.transaction((tx) => applyLedgerEntry(tx, { userId, delta: coins, reason: 'daily_puzzle', refType: 'daily_puzzle', refId: dateKey, idempotencyKey: `daily_puzzle:${dateKey}:${userId}` }));
    },
    async puzzleSummaries(limit) {
      const ps = await db.select({ id: puzzles.id }).from(puzzles).where(eq(puzzles.status, 'approved')).orderBy(desc(puzzles.createdAt)).limit(limit);
      if (ps.length === 0) return [];
      const gs = await db.select({ puzzleId: puzzleGroups.puzzleId, title: puzzleGroups.titleFa }).from(puzzleGroups).where(inArray(puzzleGroups.puzzleId, ps.map((p) => p.id))).orderBy(asc(puzzleGroups.level));
      return ps.map((p) => ({ id: p.id, titles: gs.filter((g) => g.puzzleId === p.id).map((g) => g.title ?? '') }));
    },
    async titleOf(themeId) {
      const [r] = await db.select({ t: puzzleThemes.titleFa }).from(puzzleThemes).where(eq(puzzleThemes.id, themeId)).limit(1);
      return r?.t ?? null;
    },
  };
}

/** In-memory twin for tests. */
export function createMemoryDailyStore(approved: string[] = []): DailyStore & { paid: { userId: string; dateKey: string; coins: number }[] } {
  const themes = new Map<string, ThemeRow>();
  const links = new Set<string>();
  const days = new Map<string, DailyRow>();
  const plays = new Map<string, PlayResult>();
  const paid: { userId: string; dateKey: string; coins: number }[] = [];
  const playedOn = (dateKey: string) => [...plays.keys()].some((k) => k.endsWith(`|${dateKey}`));
  const key = (u: string, d: string) => `${u}|${d}`;
  return {
    paid,
    async themes() { return [...themes.values()]; },
    async candidates() {
      return [...themes.values()].filter((t) => t.isActive).map((t) => ({ ...t, puzzleIds: [...links].filter((l) => l.startsWith(`${t.id}|`)).map((l) => l.split('|')[1]!).filter((p) => approved.includes(p)) }));
    },
    async linkCounts() {
      const out: Record<string, number> = {};
      for (const l of links) out[l.split('|')[0]!] = (out[l.split('|')[0]!] ?? 0) + 1;
      return out;
    },
    async saveTheme(id, t) {
      const row = { id: id ?? uuidv7(), ...t };
      if (id && !themes.has(id)) return null;
      themes.set(row.id, row);
      return row;
    },
    async deleteTheme(id) {
      for (const l of [...links]) if (l.startsWith(`${id}|`)) links.delete(l);
      return themes.delete(id);
    },
    async link(themeId, puzzleId, on) {
      if (!themes.has(themeId) || !approved.includes(puzzleId)) return 'not_found';
      if (on) links.add(`${themeId}|${puzzleId}`); else links.delete(`${themeId}|${puzzleId}`);
      return 'ok';
    },
    async linked(themeId) { return [...links].filter((l) => l.startsWith(`${themeId}|`)).map((l) => l.split('|')[1]!); },
    async allApprovedIds() { return [...approved]; },
    async forDate(d) { return days.get(d) ?? null; },
    async setForDate(row) {
      if (row.pinnedBy === 'auto') {
        if (days.has(row.dateKey)) return 'exists';
        days.set(row.dateKey, row);
        return 'ok';
      }
      if (playedOn(row.dateKey)) return 'played';
      days.set(row.dateKey, row);
      return 'ok';
    },
    async clearDate(d) {
      if (playedOn(d)) return 'played';
      days.delete(d);
      return 'ok';
    },
    async range(a, b) { return [...days.values()].filter((r) => r.dateKey >= a && r.dateKey < b).sort((x, y) => x.dateKey.localeCompare(y.dateKey)); },
    async usedPuzzles(a, b) { return new Set([...days.values()].filter((r) => r.dateKey >= a && r.dateKey < b).map((r) => r.puzzleId)); },
    async play(u, d) { return plays.get(key(u, d)) ?? null; },
    async startPlay(u, d) {
      if (plays.has(key(u, d))) return false;
      plays.set(key(u, d), 'playing');
      return true;
    },
    async finishPlay(u, d, result) {
      if (plays.get(key(u, d)) !== 'playing') return false;
      plays.set(key(u, d), result);
      return true;
    },
    async wonDays(u, limit) { return [...plays.entries()].filter(([k, v]) => k.startsWith(`${u}|`) && v === 'won').map(([k]) => k.split('|')[1]!).sort().reverse().slice(0, limit); },
    async payReward(userId, dateKey, coins) {
      if (!paid.some((p) => p.userId === userId && p.dateKey === dateKey)) paid.push({ userId, dateKey, coins });
    },
    async titleOf(id) { return themes.get(id)?.titleFa ?? null; },
    async puzzleSummaries() { return approved.map((id) => ({ id, titles: [id] })); },
  };
}
