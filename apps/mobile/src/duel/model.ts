import type { MatchEnded, MatchFound, MatchView, SoloSolvedGroup } from '@dozari/shared';

/** What the duel screen shows. The server sends full snapshots; this only keeps names (solved rows list ids) and the end screen. */
export type DuelPhase = 'idle' | 'queued' | 'playing' | 'ended';

export interface DuelState {
  phase: DuelPhase;
  waitedSec: number;
  found: MatchFound | null;
  view: MatchView | null;
  ended: MatchEnded | null;
  names: Record<string, string>;
  /** Last guess outcome for a short flash. */
  flash: 'correct' | 'one_away' | 'wrong' | 'timeout' | null;
  error: string | null;
}

export const initialDuel: DuelState = { phase: 'idle', waitedSec: 0, found: null, view: null, ended: null, names: {}, flash: null, error: null };

export type DuelAction =
  | { t: 'queued' }
  | { t: 'status'; waitedSec: number }
  | { t: 'found'; found: MatchFound }
  | { t: 'state'; view: MatchView }
  | { t: 'guess'; outcome: 'correct' | 'one_away' | 'wrong'; mine: boolean }
  | { t: 'timeout'; mine: boolean }
  | { t: 'ended'; ended: MatchEnded }
  | { t: 'clearFlash' }
  | { t: 'error'; error: string }
  | { t: 'reset' };

export function duelReducer(s: DuelState, a: DuelAction): DuelState {
  switch (a.t) {
    case 'queued':
      return { ...initialDuel, phase: 'queued' };
    case 'status':
      return s.phase === 'queued' ? { ...s, waitedSec: a.waitedSec } : s;
    case 'found':
      return { ...s, phase: 'playing', found: a.found, ended: null, error: null };
    case 'state': {
      const names = { ...s.names, ...Object.fromEntries(a.view.cards.map((c) => [c.id, c.nameFa])) };
      return { ...s, phase: a.view.status === 'finished' ? s.phase === 'ended' ? 'ended' : 'playing' : 'playing', view: a.view, names };
    }
    case 'guess':
      // Only the player's own guess flashes; the opponent's shows through the board changing.
      return a.mine ? { ...s, flash: a.outcome } : s;
    case 'timeout':
      return a.mine ? { ...s, flash: 'timeout' } : s;
    case 'ended':
      return { ...s, phase: 'ended', ended: a.ended };
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

/** Seconds left on the turn clock, never negative. */
export const turnSecondsLeft = (view: MatchView, nowMs: number): number => Math.max(0, Math.ceil((view.turnEndsAt - nowMs) / 1000));

/** 'won' | 'lost' | 'draw' from the player's side. */
export function myOutcome(ended: MatchEnded, you: 0 | 1): 'won' | 'lost' | 'draw' {
  const w = ended.result.winner;
  return w === null ? 'draw' : w === you ? 'won' : 'lost';
}
