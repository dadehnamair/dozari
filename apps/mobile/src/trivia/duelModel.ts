import type { ErrorCode, TduelEnded, TduelFound, TduelState } from '@dozari/shared';

/** Where a question duel is: picking is the screen's own stage, this model starts at the search. */
export type TduelPhase = 'idle' | 'queued' | 'found' | 'playing' | 'ended';

export interface TduelModel {
  phase: TduelPhase;
  waitedSec: number;
  found: TduelFound | null;
  state: TduelState | null;
  ended: TduelEnded | null;
  /** A connection problem to show; cleared by the next join. */
  error: 'NETWORK' | null;
  /** The rematch chance after a played game: the rival asked (`asked`), I asked and wait (`sent`), or it is gone (`expired`). */
  rematch: 'none' | 'asked' | 'sent' | 'expired';
  /** The server refused to turn the search or rematch into a game (e.g. no coins for the fee). */
  refused: ErrorCode | null;
}

export type TduelAction =
  | { t: 'queued' }
  | { t: 'status'; waitedSec: number }
  | { t: 'found'; found: TduelFound }
  | { t: 'state'; state: TduelState }
  | { t: 'ended'; ended: TduelEnded }
  | { t: 'error'; error: 'NETWORK' }
  | { t: 'offer'; state: 'asked' | 'expired' }
  | { t: 'rematchSent' }
  | { t: 'refused'; error: ErrorCode }
  | { t: 'reset' };

export const initialTduel: TduelModel = { phase: 'idle', waitedSec: 0, found: null, state: null, ended: null, error: null, rematch: 'none', refused: null };

export function tduelReducer(m: TduelModel, a: TduelAction): TduelModel {
  switch (a.t) {
    case 'queued':
      return { ...initialTduel, phase: 'queued' };
    case 'status':
      return m.phase === 'queued' ? { ...m, waitedSec: a.waitedSec } : m;
    case 'found':
      // A re-sent card of the same game (reconnect) must not throw a running game back to the versus screen; a new game (a rematch) starts clean.
      if ((m.phase === 'playing' || m.phase === 'ended') && m.found?.matchId === a.found.matchId) return m;
      return { ...initialTduel, phase: 'found', found: a.found, waitedSec: m.waitedSec };
    case 'state':
      return m.phase === 'ended' && m.ended?.matchId === a.state.matchId ? m : { ...m, phase: 'playing', state: a.state, error: null };
    case 'ended':
      return { ...m, phase: 'ended', ended: a.ended, rematch: 'none' };
    case 'offer':
      // The chance only exists after a played game; a late push for an old game is ignored.
      return m.phase === 'ended' ? { ...m, rematch: a.state === 'asked' ? (m.rematch === 'sent' ? 'sent' : 'asked') : 'expired' } : m;
    case 'rematchSent':
      return { ...m, rematch: 'sent' };
    case 'refused':
      return { ...initialTduel, refused: a.error };
    case 'error':
      return { ...m, error: a.error };
    case 'reset':
      return initialTduel;
  }
}

/** How the finished game went for the receiver. */
export function tduelOutcome(ended: TduelEnded, you: 0 | 1): 'won' | 'lost' | 'draw' {
  return ended.winner === null ? 'draw' : ended.winner === you ? 'won' : 'lost';
}
