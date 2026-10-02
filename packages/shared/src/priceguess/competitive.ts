import { PRICE_GUESS_ROUND_POINTS } from '../config/index.js';
import { guessDistance } from './scoring.js';
import type { PriceGuessRound } from './rounds.js';

export type Side = 'a' | 'b';
export type RoundWinner = Side | 'draw';

export interface RevealedRound {
  index: number;
  productId: string;
  year: number;
  actualRials: bigint;
  /** null = the side did not submit in time (worst possible guess). */
  guesses: Record<Side, bigint | null>;
  winner: RoundWinner;
}

export interface PriceGuessState {
  rounds: readonly PriceGuessRound[];
  /** Index of the round being played; equals rounds.length when finished. */
  index: number;
  /** Hidden guesses of the current round. */
  pending: Record<Side, bigint | null>;
  submitted: Record<Side, boolean>;
  revealed: readonly RevealedRound[];
  status: 'playing' | 'finished';
}

export type PriceGuessCommand =
  | { type: 'submit_guess'; side: Side; guessRials: bigint }
  /** The round timer ran out (server-issued): unsubmitted sides get the worst possible guess. */
  | { type: 'timeout' };

const NOT_SUBMITTED = { a: false, b: false } as const;
const NO_GUESS = { a: null, b: null } as const;

export function startPriceGuess(rounds: readonly PriceGuessRound[]): PriceGuessState {
  return {
    rounds,
    index: 0,
    pending: { ...NO_GUESS },
    submitted: { ...NOT_SUBMITTED },
    revealed: [],
    status: rounds.length === 0 ? 'finished' : 'playing',
  };
}

/** Closer wins; equal distance is a draw; a missing guess loses to any guess, two missing is a draw. */
export function roundWinner(actual: bigint, a: bigint | null, b: bigint | null): RoundWinner {
  if (a === null && b === null) return 'draw';
  if (a === null) return 'b';
  if (b === null) return 'a';
  const da = guessDistance(a, actual);
  const db = guessDistance(b, actual);
  return da === db ? 'draw' : da < db ? 'a' : 'b';
}

function reveal(state: PriceGuessState): PriceGuessState {
  const round = state.rounds[state.index] as PriceGuessRound;
  const done: RevealedRound = {
    index: state.index,
    productId: round.productId,
    year: round.year,
    actualRials: round.actualRials,
    guesses: { ...state.pending },
    winner: roundWinner(round.actualRials, state.pending.a, state.pending.b),
  };
  const index = state.index + 1;
  return {
    ...state,
    index,
    pending: { ...NO_GUESS },
    submitted: { ...NOT_SUBMITTED },
    revealed: [...state.revealed, done],
    status: index >= state.rounds.length ? 'finished' : 'playing',
  };
}

/** Pure transition. Illegal commands (finished, resubmission, non-positive guess) return the state unchanged. */
export function applyPriceGuessCommand(state: PriceGuessState, cmd: PriceGuessCommand): PriceGuessState {
  if (state.status !== 'playing') return state;
  if (cmd.type === 'timeout') return reveal(state);
  if (state.submitted[cmd.side] || cmd.guessRials <= 0n) return state;
  const next: PriceGuessState = {
    ...state,
    pending: { ...state.pending, [cmd.side]: cmd.guessRials },
    submitted: { ...state.submitted, [cmd.side]: true },
  };
  return next.submitted.a && next.submitted.b ? reveal(next) : next;
}

/** Match-score points each side earned from price-guess rounds. */
export function priceGuessPoints(state: PriceGuessState): Record<Side, number> {
  const pts = { a: 0, b: 0 };
  for (const r of state.revealed) if (r.winner !== 'draw') pts[r.winner] += PRICE_GUESS_ROUND_POINTS;
  return pts;
}

/** What one side may see: never the real price or the opponent's hidden guess before the reveal. */
export interface PriceGuessClientView {
  status: PriceGuessState['status'];
  roundIndex: number;
  totalRounds: number;
  /** The item being asked about now (no price), null when finished. */
  current: { productId: string; year: number } | null;
  /** Whether this side has already locked in a guess this round. */
  youSubmitted: boolean;
  /** Whether the opponent has submitted (a fact, not the number). */
  opponentSubmitted: boolean;
  revealed: readonly RevealedRound[];
}

export function priceGuessClientView(state: PriceGuessState, side: Side): PriceGuessClientView {
  const round = state.rounds[state.index];
  return {
    status: state.status,
    roundIndex: state.index,
    totalRounds: state.rounds.length,
    current: state.status === 'playing' && round ? { productId: round.productId, year: round.year } : null,
    youSubmitted: state.submitted[side],
    opponentSubmitted: state.submitted[side === 'a' ? 'b' : 'a'],
    revealed: state.revealed,
  };
}
