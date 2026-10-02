import { mulberry32 } from '../game/rng.js';
import { gregorianToJalali } from '../calendar/solar-month.js';

/**
 * Daily puzzle selection (docs/logic/daily-puzzle.md). Pure: the server loads themes and history, this decides.
 * A theme is an occasion (Nowruz), a season, a trend or a category; it is active on a day when the Tehran date falls in
 * its recurring Solar Hijri window (month/day, may wrap the year end) and/or its absolute window.
 */

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DailyTheme {
  id: string;
  weight: number;
  /** Recurring yearly window in Solar Hijri; all four set or all null. */
  startMonth: number | null;
  startDay: number | null;
  endMonth: number | null;
  endDay: number | null;
  /** Absolute window, Gregorian `YYYY-MM-DD` in Tehran time; either end may be null (open). */
  fromDate: string | null;
  toDate: string | null;
}

export interface DailyCandidates extends DailyTheme {
  /** Approved puzzles linked to the theme. */
  puzzleIds: readonly string[];
}

/** The Tehran calendar date of an instant as `YYYY-MM-DD` (the day key of everything daily). */
export function dailyDateKey(epochMs: number): string {
  const d = new Date(epochMs + 3.5 * 3_600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function isDateKey(s: string): boolean {
  const m = DATE_KEY.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** The date key `days` days after (or before, negative) `dateKey`; calendar arithmetic, no time zones involved. */
export function shiftDateKey(dateKey: string, days: number): string {
  const m = DATE_KEY.exec(dateKey);
  if (!m) return dateKey;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Date keys of the `days` days starting at `dateKey` (inclusive). */
export function dateKeysFrom(dateKey: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => shiftDateKey(dateKey, i));
}

export function themeActiveOn(theme: Omit<DailyTheme, 'id' | 'weight'> & Partial<Pick<DailyTheme, 'id' | 'weight'>>, dateKey: string): boolean {
  const m = DATE_KEY.exec(dateKey);
  if (!m) return false;
  if (theme.fromDate && dateKey < theme.fromDate) return false;
  if (theme.toDate && dateKey > theme.toDate) return false;
  if (theme.startMonth == null || theme.startDay == null || theme.endMonth == null || theme.endDay == null) return true;
  const j = gregorianToJalali(Number(m[1]), Number(m[2]), Number(m[3]));
  const now = j.month * 100 + j.day;
  const start = theme.startMonth * 100 + theme.startDay;
  const end = theme.endMonth * 100 + theme.endDay;
  return start <= end ? now >= start && now <= end : now >= start || now <= end;
}

function hashKey(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export interface DailyPick {
  puzzleId: string;
  themeId: string | null;
}

/**
 * Today's puzzle: themes active today are tried by weighted random order (seeded by the date, so every server instance
 * agrees); the first with a puzzle not used recently wins. Else any puzzle not used recently, else any puzzle.
 */
export function pickDaily(input: { dateKey: string; themes: readonly DailyCandidates[]; allPuzzleIds: readonly string[]; recentPuzzleIds: ReadonlySet<string> }): DailyPick | null {
  const rng = mulberry32(hashKey(input.dateKey));
  const pool = input.themes.filter((t) => t.weight > 0 && themeActiveOn(t, input.dateKey));
  const order: DailyCandidates[] = [];
  while (pool.length > 0) {
    const total = pool.reduce((s, t) => s + t.weight, 0);
    let roll = rng() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      roll -= pool[idx]!.weight;
      if (roll < 0) break;
    }
    order.push(pool.splice(idx, 1)[0]!);
  }
  const choose = (ids: readonly string[]) => ids[Math.floor(rng() * ids.length)]!;
  for (const t of order) {
    const fresh = [...t.puzzleIds].sort().filter((id) => !input.recentPuzzleIds.has(id));
    if (fresh.length > 0) return { puzzleId: choose(fresh), themeId: t.id };
  }
  const all = [...input.allPuzzleIds].sort();
  const fresh = all.filter((id) => !input.recentPuzzleIds.has(id));
  if (fresh.length > 0) return { puzzleId: choose(fresh), themeId: null };
  if (all.length > 0) return { puzzleId: choose(all), themeId: null };
  return null;
}
