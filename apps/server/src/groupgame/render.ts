import { GROUP_BUTTONS_PER_ROW, GROUP_CARD_LABEL_MAX } from '@dozari/shared';
import type { SoloState } from '@dozari/shared';
import type { InlineKeyboard } from '../notify/client.js';
import type { ServedPuzzle } from '../solo/types.js';
import { GROUP_TEXT } from './texts.js';

const LEVEL_EMOJI = ['🟨', '🟩', '🟦', '🟪'] as const;

export interface BoardView {
  puzzle: ServedPuzzle;
  state: SoloState;
  /** Product ids ticked on the shared board. */
  selection: readonly string[];
  rev: number;
  maxMistakes: number;
  dateFa: string;
  /** The last thing that happened, shown under the board. */
  note: string;
  players: number;
  /** Mini-app deep link for the call-to-action button; absent = no button. */
  ctaUrl: string | null;
}

const cut = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** One solved (or revealed) group as a line: level colour, its title, the four names. Only ever built from `state.solved`. */
function groupLine(v: BoardView, g: SoloState['solved'][number]): string {
  const meta = v.puzzle.groups.find((x) => x.level === g.level);
  const names = g.productIds.map((id) => v.puzzle.items[id]?.nameFa ?? '').join('، ');
  return `${LEVEL_EMOJI[g.level]} ${meta?.titleFa ?? ''}${g.revealed ? ' (نشان داده شد)' : ''}\n   ${names}`;
}

const ctaRow = (v: BoardView): InlineKeyboard => (v.ctaUrl ? [[{ text: GROUP_TEXT.ctaButton, url: v.ctaUrl }]] : []);

/** The message and keyboard of the shared board. Unsolved groups never appear here (rule 4). */
export function renderBoard(v: BoardView): { text: string; keyboard: InlineKeyboard } {
  const { state } = v;
  const lines = [GROUP_TEXT.title(v.dateFa), ''];
  if (state.solved.length > 0) lines.push(...state.solved.map((g) => groupLine(v, g)), '');

  if (state.status !== 'playing') {
    const won = state.status === 'won';
    lines.push(won ? GROUP_TEXT.won : GROUP_TEXT.lost, GROUP_TEXT.summary(state.mistakes, v.players), '', GROUP_TEXT.cta);
    return { text: lines.join('\n'), keyboard: ctaRow(v) };
  }

  const left = Math.max(0, v.maxMistakes - state.mistakes);
  lines.push(`${GROUP_TEXT.mistakes} ${'❤️'.repeat(left)}${'🖤'.repeat(v.maxMistakes - left)}`);
  if (v.selection.length > 0) lines.push(`${GROUP_TEXT.selected} ${v.selection.map((id) => v.puzzle.items[id]?.nameFa ?? '').join('، ')}`);
  if (v.note) lines.push('', v.note);

  const picked = new Set(v.selection);
  const keyboard: InlineKeyboard = [];
  for (let i = 0; i < state.remaining.length; i += GROUP_BUTTONS_PER_ROW) {
    keyboard.push(
      state.remaining.slice(i, i + GROUP_BUTTONS_PER_ROW).map((id, j) => {
        const label = cut(v.puzzle.items[id]?.nameFa ?? '?', GROUP_CARD_LABEL_MAX);
        return { text: picked.has(id) ? `✅ ${label}` : label, callback_data: `g:${v.rev}:t${i + j}` };
      }),
    );
  }
  keyboard.push([
    { text: GROUP_TEXT.submit, callback_data: `g:${v.rev}:s` },
    { text: GROUP_TEXT.clear, callback_data: `g:${v.rev}:c` },
    { text: GROUP_TEXT.shuffle, callback_data: `g:${v.rev}:h` },
  ]);
  return { text: lines.join('\n'), keyboard };
}

/** «g:<rev>:<action>» from a button; null when it is not ours or malformed. */
export function parseCallback(data: string | undefined): { rev: number; action: 's' | 'c' | 'h' | { card: number } } | null {
  const m = /^g:(\d{1,9}):(s|c|h|t(\d{1,2}))$/.exec(data ?? '');
  if (!m) return null;
  const rev = Number(m[1]);
  if (m[3] !== undefined) return { rev, action: { card: Number(m[3]) } };
  return { rev, action: m[2] as 's' | 'c' | 'h' };
}
