import type { MatchEnded, MatchFound, MatchView, QueueProblem, SoloCard, SoloSolvedGroup } from '@dozari/shared';

/** What the duel screen shows. The server sends full snapshots; this only keeps names (solved rows list ids) and the end screen. */
export type DuelPhase = 'idle' | 'queued' | 'playing' | 'ended';

export interface DuelState {
  phase: DuelPhase;
  waitedSec: number;
  /** Why the queue is going nowhere, as the server reports it while the player waits. */
  problem: QueueProblem | null;
  found: MatchFound | null;
  view: MatchView | null;
  ended: MatchEnded | null;
  names: Record<string, string>;
  /** Last guess outcome for a short flash. */
  /** The opponent's latest canned taunt. */
  taunt: { from: string; text: string } | null;
  flash: 'correct' | 'one_away' | 'wrong' | 'timeout' | null;
  /** A multi-board match just moved on: the board now in play (1-based) and the total, for a short banner. */
  boardNote: { board: number; of: number } | null;
  /** A fatal problem (no connection, the queue refused): replaces the screen with an error card. */
  error: string | null;
  /** A passing problem during play (a refused submit, a late ack): a toast, never a dead end. Holds the error code. */
  notice: string | null;
  /** The last snapshot of the board that just ended (its cards were still on the table). */
  prevBoard: MatchView | null;
  /** Level of the group the game revealed by itself when the board ended. */
  revealedLevel: number | null;
  /** The last row playing itself out: the last four cards light up one by one before the board moves on or the result shows. */
  finale: Finale | null;
}

/** The end of a board as the player sees it: three rows found, four cards left that the game now selects by itself. */
export interface Finale {
  key: string;
  solved: SoloSolvedGroup[];
  cards: SoloCard[];
  last: SoloSolvedGroup;
}

type GroupText = { level: number; titleFa: string; explanationFa: string; productIds: readonly string[] };

/**
 * The finale of a board that ended with three groups found: `groups` is the full solution (or the solved rows of the finished
 * view) and `level` the group the game revealed. Null when the board did not end that way or the snapshot before it is missing.
 */
export function buildFinale(prev: MatchView | null, groups: readonly GroupText[], level: number | null, key: string): Finale | null {
  if (!prev || level === null || prev.solved.length !== 2) return null;
  const last = groups.find((g) => g.level === level);
  const doneLevels = new Set<number>(prev.solved.map((g) => g.level));
  const third = groups.find((g) => g.level !== level && !doneLevels.has(g.level));
  if (!last || !third) return null;
  const lastIds = new Set(last.productIds);
  const cards = prev.cards.filter((c) => lastIds.has(c.id));
  if (cards.length !== lastIds.size || cards.length === 0) return null;
  const row = (g: GroupText, revealed: boolean): SoloSolvedGroup => ({ level: g.level as SoloSolvedGroup['level'], titleFa: g.titleFa, explanationFa: g.explanationFa, productIds: [...g.productIds], revealed });
  return { key, solved: [...prev.solved.map((g) => ({ level: g.level, titleFa: g.titleFa, explanationFa: g.explanationFa, productIds: [...g.productIds], revealed: g.by === null })), row(third, false)], cards, last: row(last, true) };
}

/** An «ended» message built from the last snapshot, for when the server's own one never came (a lost packet must not trap the player on the board). */
export function endedFromView(view: MatchView): MatchEnded | null {
  if (view.status !== 'finished' || !view.result || view.solved.length !== 4) return null;
  const groups = [...view.solved].sort((a, b) => a.level - b.level).map((g) => ({ level: g.level, titleFa: g.titleFa, explanationFa: g.explanationFa, productIds: [...g.productIds] }));
  return { matchId: view.matchId, result: view.result, scores: [view.scores[0], view.scores[1]], groups: groups as MatchEnded['groups'] };
}

export const initialDuel: DuelState = { phase: 'idle', waitedSec: 0, problem: null, found: null, view: null, ended: null, names: {}, taunt: null, flash: null, boardNote: null, error: null, notice: null, prevBoard: null, revealedLevel: null, finale: null };

export type DuelAction =
  | { t: 'queued' }
  | { t: 'status'; waitedSec: number; problem?: QueueProblem }
  | { t: 'found'; found: MatchFound }
  | { t: 'state'; view: MatchView }
  | { t: 'guess'; outcome: 'correct' | 'one_away' | 'wrong'; mine: boolean }
  | { t: 'timeout'; mine: boolean }
  | { t: 'ended'; ended: MatchEnded }
  | { t: 'clearFlash' }
  | { t: 'board'; board: number; of: number }
  | { t: 'clearBoard' }
  | { t: 'taunt'; from: string; text: string }
  | { t: 'clearTaunt' }
  | { t: 'error'; error: string }
  /** A refused submit or a late answer during play: a toast, not an error screen. */
  | { t: 'notice'; error: string }
  | { t: 'clearNotice' }
  | { t: 'revealed'; level: number }
  | { t: 'boardDone'; round: number; groups?: readonly GroupText[] }
  | { t: 'clearFinale' }
  | { t: 'reset' };

export function duelReducer(s: DuelState, a: DuelAction): DuelState {
  switch (a.t) {
    case 'queued':
      return { ...initialDuel, phase: 'queued' };
    case 'status':
      return s.phase === 'queued' ? { ...s, waitedSec: a.waitedSec, problem: a.problem ?? null } : s;
    case 'found':
      // The same match announced again (a reconnect or a resume): keep what the screen is showing.
      if (s.found?.matchId === a.found.matchId && s.phase !== 'idle' && s.phase !== 'queued') return { ...s, found: a.found, error: null };
      return { ...s, phase: 'playing', found: a.found, ended: null, error: null, notice: null, prevBoard: null, revealedLevel: null, finale: null };
    case 'state': {
      const names = { ...s.names, ...Object.fromEntries(a.view.cards.map((c) => [c.id, c.nameFa])) };
      const prev = s.view;
      // The board just ended (its cards are gone or a new board began): keep the snapshot that still had them for the finale.
      const over = !!prev && prev.cards.length > 0 && (a.view.cards.length === 0 || (a.view.round ?? 0) !== (prev.round ?? 0));
      return { ...s, phase: a.view.status === 'finished' ? s.phase === 'ended' ? 'ended' : 'playing' : 'playing', view: a.view, names, error: s.phase === 'ended' ? s.error : null, prevBoard: over ? prev : s.prevBoard, revealedLevel: over ? null : s.revealedLevel };
    }
    case 'revealed': {
      // The game revealed the last group by itself: when the board ended on the same snapshot (the match is over, or the price round follows) the finale can start now.
      const level = s.revealedLevel ?? a.level;
      const view = s.view;
      const sameBoard = !!view && !!s.prevBoard && (view.round ?? 0) === (s.prevBoard.round ?? 0);
      const revealed = view ? view.solved.filter((g) => g.by === null) : [];
      const finale = !s.finale && sameBoard && revealed.length === 1 ? buildFinale(s.prevBoard, view!.solved, level, `${view!.matchId}:${view!.round ?? 0}`) : null;
      return { ...s, revealedLevel: level, finale: finale ?? s.finale };
    }
    case 'boardDone': {
      const view = s.view;
      const finale = !s.finale && a.groups && view ? buildFinale(s.prevBoard, a.groups, s.revealedLevel, `${view.matchId}:${a.round}`) : null;
      return { ...s, finale: finale ?? s.finale };
    }
    case 'clearFinale':
      return { ...s, finale: null };
    case 'notice':
      return { ...s, notice: a.error };
    case 'clearNotice':
      return { ...s, notice: null };
    case 'guess':
      // Only the player's own guess flashes; the opponent's shows through the board changing.
      return a.mine ? { ...s, flash: a.outcome } : s;
    case 'timeout':
      return a.mine ? { ...s, flash: 'timeout' } : s;
    case 'ended':
      return { ...s, phase: 'ended', ended: a.ended, error: null, notice: null };
    case 'taunt':
      return { ...s, taunt: { from: a.from, text: a.text } };
    case 'clearTaunt':
      return { ...s, taunt: null };
    case 'board':
      return { ...s, boardNote: { board: a.board, of: a.of } };
    case 'clearBoard':
      return { ...s, boardNote: null };
    case 'clearFlash':
      return { ...s, flash: null };
    case 'error':
      return { ...s, error: a.error };
    case 'reset':
      return initialDuel;
  }
}

/** The shape `Board` draws for solved rows: a group found by nobody was shown by the game. */
export function boardSolved(view: MatchView): SoloSolvedGroup[] {
  return view.solved.map((g) => ({ level: g.level, titleFa: g.titleFa, explanationFa: g.explanationFa, productIds: g.productIds, revealed: g.by === null }));
}

export const isMyTurn = (view: MatchView): boolean => view.status === 'playing' && view.turn === view.you && !view.lockedOut[view.you];

/** In 2v2 only the captain of the turn submits; older snapshots without captains mean everyone on the side may. */
export const isCaptain = (view: MatchView): boolean => !view.captain || !view.youId || view.captain[view.you] === view.youId;

/** The players of a side, in the order the server listed them. */
export const sidePlayers = (found: MatchFound | null, side: 0 | 1) => (found?.players ?? []).filter((p) => p.side === side);

/** «A و B» for a team, the plain nickname for a lone player. */
export const sideName = (found: MatchFound | null, side: 0 | 1, joiner: (x: string, y: string) => string): string =>
  sidePlayers(found, side).map((p) => p.nickname).reduce((acc, n) => (acc ? joiner(acc, n) : n), '');

/** Seconds left on the turn clock, never negative. */
export const turnSecondsLeft = (view: MatchView, nowMs: number): number => Math.max(0, Math.ceil((view.turnEndsAt - nowMs) / 1000));

/** 'won' | 'lost' | 'draw' from the player's side. */
export function myOutcome(ended: MatchEnded, you: 0 | 1): 'won' | 'lost' | 'draw' {
  const w = ended.result.winner;
  return w === null ? 'draw' : w === you ? 'won' : 'lost';
}
