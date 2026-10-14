import type { TduelEnded, TduelFound, TduelState } from '@dozari/shared';

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
}

export type TduelAction =
  | { t: 'queued' }
  | { t: 'status'; waitedSec: number }
  | { t: 'found'; found: TduelFound }
  | { t: 'state'; state: TduelState }
  | { t: 'ended'; ended: TduelEnded }
  | { t: 'error'; error: 'NETWORK' }
  | { t: 'reset' };

export const initialTduel: TduelModel = { phase: 'idle', waitedSec: 0, found: null, state: null, ended: null, error: null };

export function tduelReducer(m: TduelModel, a: TduelAction): TduelModel {
  switch (a.t) {
    case 'queued':
      return { ...initialTduel, phase: 'queued' };
    case 'status':
      return m.phase === 'queued' ? { ...m, waitedSec: a.waitedSec } : m;
    case 'found':
      // A re-sent card (reconnect) must not throw a running game back to the versus screen.
      return m.phase === 'playing' || m.phase === 'ended' ? m : { ...m, phase: 'found', found: a.found, error: null };
    case 'state':
      return m.phase === 'ended' ? m : { ...m, phase: 'playing', state: a.state, error: null };
    case 'ended':
      return { ...m, phase: 'ended', ended: a.ended };
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
