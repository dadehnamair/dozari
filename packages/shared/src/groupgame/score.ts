import { GROUP_POINTS_LEVEL_BONUS, GROUP_POINTS_PER_GROUP } from '../config/groupgame.js';
import type { GroupLevel } from '../game/solo.js';

/** Points for the player who finds a group of this level in a group chat. */
export function groupPoints(level: GroupLevel): number {
  return GROUP_POINTS_PER_GROUP + GROUP_POINTS_LEVEL_BONUS * level;
}

/**
 * The week a Tehran date key (`YYYY-MM-DD`) belongs to, named by its Saturday (the Iranian week starts on Saturday).
 * Pure calendar arithmetic on the key, no clock.
 */
export function groupWeekKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  const day = new Date(Date.UTC(y, m - 1, d));
  const sinceSaturday = (day.getUTCDay() + 1) % 7; // Sat 0, Sun 1 .. Fri 6
  day.setUTCDate(day.getUTCDate() - sinceSaturday);
  return `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, '0')}-${String(day.getUTCDate()).padStart(2, '0')}`;
}

export interface GroupScoreRow {
  userRef: string;
  name: string;
  points: number;
  groups: number;
  wrong: number;
}

/** Leaderboard order: points, then groups found, then fewer wrong submits, then name (stable). */
export function rankGroupScores(rows: readonly GroupScoreRow[]): GroupScoreRow[] {
  return [...rows].sort((a, b) => b.points - a.points || b.groups - a.groups || a.wrong - b.wrong || a.name.localeCompare(b.name, 'fa'));
}
