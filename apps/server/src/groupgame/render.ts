import { GROUP_BUTTONS_PER_ROW, GROUP_CARD_LABEL_MAX } from '@dozari/shared';
import type { InlineKeyboard } from '../notify/client.js';
import type { ServedPuzzle } from '../solo/types.js';
import { GROUP_TEXT } from './texts.js';

export const LEVEL_EMOJI = ['🟨', '🟩', '🟦', '🟪'] as const;

export interface BoardView {
  puzzle: ServedPuzzle;
  /** The 16 product ids in the one order every member sees (button `t<i>` = `order[i]`). */
  order: readonly string[];
  rev: number;
  dateFa: string;
  /** Whole minutes of play time the round was opened with. */
  minutes: number;
}

const cut = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * The shared message of a round (docs/logic/group-game.md §Rules of the round). Every member plays alone on this one static board: what a member
 * ticks and finds is answered to them only, so the message itself never shows a solution or anybody's picks (rule 4).
 */
export function renderBoard(v: BoardView): { text: string; keyboard: InlineKeyboard } {
  const keyboard: InlineKeyboard = [];
  for (let i = 0; i < v.order.length; i += GROUP_BUTTONS_PER_ROW) {
    keyboard.push(
      v.order.slice(i, i + GROUP_BUTTONS_PER_ROW).map((id, j) => ({
        text: cut(v.puzzle.items[id]?.nameFa ?? '?', GROUP_CARD_LABEL_MAX),
        callback_data: `g:${v.rev}:t${i + j}`,
      })),
    );
  }
  keyboard.push([
    { text: GROUP_TEXT.submit, callback_data: `g:${v.rev}:s` },
    { text: GROUP_TEXT.clear, callback_data: `g:${v.rev}:c` },
  ]);
  return { text: [GROUP_TEXT.title(v.dateFa), '', GROUP_TEXT.howTo(v.minutes)].join('\n'), keyboard };
}

/** A member's standing at the end: groups found, mistakes made, and when the last group was found (earlier wins a tie). */
export interface PlayerResult {
  name: string;
  groups: number;
  mistakes: number;
  lastSolvedAt: number;
}

/** Best first: more groups, fewer mistakes, found earlier, then name. */
export function rankPlayers<T extends PlayerResult>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => b.groups - a.groups || a.mistakes - b.mistakes || a.lastSolvedAt - b.lastSolvedAt || a.name.localeCompare(b.name, 'fa'));
}

/** The closed round: the four answers (safe now, the round is over) and everyone's result. */
export function renderResults(v: { puzzle: ServedPuzzle; dateFa: string; ranked: readonly PlayerResult[]; maxRows: number }): string {
  const lines = [GROUP_TEXT.resultsTitle(v.dateFa), ''];
  lines.push(...[...v.puzzle.groups].sort((a, b) => a.level - b.level).map((g) => `${LEVEL_EMOJI[g.level]} ${g.titleFa}\n   ${g.productIds.map((id) => v.puzzle.items[id]?.nameFa ?? '').join('، ')}`), '');
  if (v.ranked.length === 0) lines.push(GROUP_TEXT.resultsNobody);
  else {
    lines.push(GROUP_TEXT.resultsHeader);
    lines.push(...v.ranked.slice(0, v.maxRows).map((r, i) => GROUP_TEXT.resultRow(i + 1, r.name, r.groups, r.mistakes)));
    if (v.ranked.length > v.maxRows) lines.push(GROUP_TEXT.resultsMore(v.ranked.length - v.maxRows));
  }
  lines.push('', GROUP_TEXT.cta);
  return lines.join('\n');
}

/** «g:<rev>:<action>» from a button; null when it is not ours or malformed. */
export function parseCallback(data: string | undefined): { rev: number; action: 's' | 'c' | 'h' | { card: number } } | null {
  const m = /^g:(\d{1,9}):(s|c|h|t(\d{1,2}))$/.exec(data ?? '');
  if (!m) return null;
  const rev = Number(m[1]);
  if (m[3] !== undefined) return { rev, action: { card: Number(m[3]) } };
  return { rev, action: m[2] as 's' | 'c' | 'h' };
}
