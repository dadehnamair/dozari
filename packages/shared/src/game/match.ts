import {
  FIRST_BLOOD_BONUS,
  GROUP_COUNT,
  GROUP_POINTS,
  GROUP_SIZE,
  MATCH_MAX_MISTAKES,
  MAX_CONSECUTIVE_TIMEOUTS,
  PRICE_GUESS_LOSER_BONUS_PER_ROUND,
  TURN_SECONDS,
} from '../config/index.js';
import type { Rng } from './rng.js';
import { initialBoardOrder, selectionKey } from './solo.js';
import type { GroupLevel, SoloPuzzle } from './solo.js';

/**
 * Competitive match reducer (docs/logic/game-rules.md §Competitive): one shared board, two sides taking
 * turns. Pure: time comes in through `ctx.now`, randomness through the injected rng, and timeouts arrive as
 * commands carrying the `turnId` they were scheduled for. 1v1 only for now (one player per side);
 * the team/captain flow is Phase 5.
 */

export type MatchSide = 0 | 1;
export const otherSide = (side: MatchSide): MatchSide => (side === 0 ? 1 : 0);

export interface MatchPlayer {
  userId: string;
  side: MatchSide;
}

export type EndReason = 'solved' | 'locked_out' | 'forfeit' | 'abandon';

export interface MatchSolvedGroup {
  level: GroupLevel;
  productIds: readonly string[];
  /** The side that found it, or null when the game revealed it (last group / end of match). */
  by: MatchSide | null;
}

export interface MatchResult {
  /** Puzzle-portion winner; null = tie to be settled by `resolveWinner` (price-guess round). */
  winner: MatchSide | null;
  reason: EndReason;
}

export interface MatchState {
  /** The solution. Server-side only; `matchClientView` is the only thing that may leave the server. */
  puzzle: SoloPuzzle;
  players: readonly [MatchPlayer, MatchPlayer];
  remaining: readonly string[];
  solved: readonly MatchSolvedGroup[];
  scores: readonly [number, number];
  mistakes: readonly [number, number];
  lockedOut: readonly [boolean, boolean];
  /** Consecutive timeouts per side. */
  timeouts: readonly [number, number];
  /** Time of each side's last correct guess (ms), for the tie-break. */
  lastCorrectAt: readonly [number | null, number | null];
  /** Canonical keys of every set submitted by either side. */
  tried: readonly string[];
  turn: MatchSide;
  /** Bumps on every turn (re)start; a timeout for an older id is stale. */
  turnId: number;
  turnStartedAt: number;
  status: 'playing' | 'finished';
  result: MatchResult | null;
}

export type Command =
  | { t: 'submit'; by: string; itemIds: readonly string[] }
  | { t: 'timeout'; turnId: number }
  | { t: 'leave'; by: string }
  | { t: 'forfeit'; side: MatchSide };

export type RuleError =
  | 'MATCH_FINISHED'
  | 'UNKNOWN_PLAYER'
  | 'NOT_YOUR_TURN'
  | 'INVALID_SELECTION'
  | 'DUPLICATE_SELECTION';

export type SubmitFeedback = 'correct' | 'one_away' | 'wrong';

export type MatchEvent =
  | { t: 'guess'; side: MatchSide; itemIds: readonly string[]; outcome: SubmitFeedback }
  | { t: 'group_solved'; side: MatchSide; level: GroupLevel; points: number; firstBlood: boolean }
  | { t: 'group_revealed'; level: GroupLevel }
  | { t: 'locked_out'; side: MatchSide }
  | { t: 'timeout'; side: MatchSide }
  | { t: 'turn'; side: MatchSide; turnId: number }
  | { t: 'finished'; result: MatchResult };

export type ApplyResult = { state: MatchState; events: MatchEvent[] } | { error: RuleError };

export interface Ctx {
  now: number;
}

export function startMatch(
  puzzle: SoloPuzzle,
  players: readonly [string, string],
  rng: Rng,
  now: number,
  startingSide?: MatchSide,
): MatchState {
  if (players[0] === players[1]) throw new Error('a match needs two different players');
  return {
    puzzle,
    players: [
      { userId: players[0], side: 0 },
      { userId: players[1], side: 1 },
    ],
    remaining: initialBoardOrder(puzzle, rng),
    solved: [],
    scores: [0, 0],
    mistakes: [0, 0],
    lockedOut: [false, false],
    timeouts: [0, 0],
    lastCorrectAt: [null, null],
    tried: [],
    turn: startingSide ?? (rng() < 0.5 ? 0 : 1),
    turnId: 1,
    turnStartedAt: now,
    status: 'playing',
    result: null,
  };
}

const set = <T>(pair: readonly [T, T], side: MatchSide, value: T): [T, T] => (side === 0 ? [value, pair[1]] : [pair[0], value]);

export const turnDeadline = (state: MatchState): number => state.turnStartedAt + TURN_SECONDS * 1000;

export function sideOf(state: MatchState, userId: string): MatchSide | null {
  return state.players.find((p) => p.userId === userId)?.side ?? null;
}

function revealRest(state: MatchState, events: MatchEvent[]): MatchState {
  const done = new Set(state.solved.map((g) => g.level));
  let next = state;
  for (const g of [...state.puzzle.groups].sort((a, b) => a.level - b.level)) {
    if (done.has(g.level)) continue;
    const ids = new Set(g.productIds);
    next = {
      ...next,
      remaining: next.remaining.filter((id) => !ids.has(id)),
      solved: [...next.solved, { level: g.level, productIds: g.productIds, by: null }],
    };
    events.push({ t: 'group_revealed', level: g.level });
  }
  return next;
}

/** Puzzle-portion winner by score, then fewer mistakes, then the earlier last correct guess; null = still tied. */
function decide(state: MatchState): MatchSide | null {
  const [s0, s1] = state.scores;
  if (s0 !== s1) return s0 > s1 ? 0 : 1;
  const [m0, m1] = state.mistakes;
  if (m0 !== m1) return m0 < m1 ? 0 : 1;
  const [t0, t1] = state.lastCorrectAt;
  if (t0 !== null && t1 !== null && t0 !== t1) return t0 < t1 ? 0 : 1;
  return null;
}

function finish(state: MatchState, reason: EndReason, winner: MatchSide | null, events: MatchEvent[]): MatchState {
  const next = revealRest({ ...state, status: 'finished' }, events);
  const result: MatchResult = { winner, reason };
  events.push({ t: 'finished', result });
  return { ...next, result };
}

/** Starts the next turn for `side` (also used to restart the clock when the same side keeps playing). */
function startTurn(state: MatchState, side: MatchSide, now: number, events: MatchEvent[]): MatchState {
  const turnId = state.turnId + 1;
  events.push({ t: 'turn', side, turnId });
  return { ...state, turn: side, turnId, turnStartedAt: now };
}

/** Who plays next after `side` just moved: the opponent, unless the opponent is locked out. */
const nextTurn = (state: MatchState, side: MatchSide): MatchSide => (state.lockedOut[otherSide(side)] ? side : otherSide(side));

function forfeit(state: MatchState, side: MatchSide, reason: 'forfeit' | 'abandon', events: MatchEvent[]): MatchState {
  return finish(state, reason, otherSide(side), events);
}

export function applyCommand(state: MatchState, cmd: Command, ctx: Ctx): ApplyResult {
  if (state.status === 'finished') return { error: 'MATCH_FINISHED' };
  const events: MatchEvent[] = [];

  switch (cmd.t) {
    case 'forfeit':
      return { state: forfeit(state, cmd.side, 'forfeit', events), events };

    case 'leave': {
      const side = sideOf(state, cmd.by);
      if (side === null) return { error: 'UNKNOWN_PLAYER' };
      return { state: forfeit(state, side, 'abandon', events), events };
    }

    case 'timeout': {
      if (cmd.turnId !== state.turnId) return { state, events }; // stale timer: ignored
      const side = state.turn;
      events.push({ t: 'timeout', side });
      const count = state.timeouts[side] + 1;
      let next: MatchState = { ...state, timeouts: set(state.timeouts, side, count) };
      if (count >= MAX_CONSECUTIVE_TIMEOUTS) return { state: forfeit(next, side, 'forfeit', events), events };
      next = startTurn(next, nextTurn(next, side), ctx.now, events);
      return { state: next, events };
    }

    case 'submit': {
      const side = sideOf(state, cmd.by);
      if (side === null) return { error: 'UNKNOWN_PLAYER' };
      if (side !== state.turn) return { error: 'NOT_YOUR_TURN' };
      const ids = cmd.itemIds;
      const onBoard = new Set(state.remaining);
      if (ids.length !== GROUP_SIZE || new Set(ids).size !== GROUP_SIZE || ids.some((id) => !onBoard.has(id))) {
        return { error: 'INVALID_SELECTION' };
      }
      const key = selectionKey(ids);
      if (state.tried.includes(key)) return { error: 'DUPLICATE_SELECTION' };

      const chosen = new Set(ids);
      const done = new Set(state.solved.map((g) => g.level));
      const open = state.puzzle.groups.filter((g) => !done.has(g.level));
      const exact = open.find((g) => g.productIds.every((id) => chosen.has(id)));
      let next: MatchState = { ...state, tried: [...state.tried, key], timeouts: set(state.timeouts, side, 0) };

      if (exact) {
        events.push({ t: 'guess', side, itemIds: ids, outcome: 'correct' });
        const firstBlood = state.solved.length === 0;
        const points = GROUP_POINTS[exact.level] + (firstBlood ? FIRST_BLOOD_BONUS : 0);
        next = {
          ...next,
          remaining: next.remaining.filter((id) => !chosen.has(id)),
          solved: [...next.solved, { level: exact.level, productIds: exact.productIds, by: side }],
          scores: set(next.scores, side, next.scores[side] + points),
          lastCorrectAt: set(next.lastCorrectAt, side, ctx.now),
        };
        events.push({ t: 'group_solved', side, level: exact.level, points, firstBlood });
        if (next.solved.length === GROUP_COUNT - 1) {
          return { state: finish(next, 'solved', decide(next), events), events };
        }
        // A correct guess keeps the turn (streak) with a fresh clock.
        return { state: startTurn(next, side, ctx.now, events), events };
      }

      const oneAway = open.some((g) => g.productIds.filter((id) => chosen.has(id)).length === GROUP_SIZE - 1);
      events.push({ t: 'guess', side, itemIds: ids, outcome: oneAway ? 'one_away' : 'wrong' });
      const mistakes = next.mistakes[side] + 1;
      next = { ...next, mistakes: set(next.mistakes, side, mistakes) };
      if (mistakes >= MATCH_MAX_MISTAKES) {
        next = { ...next, lockedOut: set(next.lockedOut, side, true) };
        events.push({ t: 'locked_out', side });
        if (next.lockedOut[otherSide(side)]) {
          return { state: finish(next, 'locked_out', decide(next), events), events };
        }
      }
      return { state: startTurn(next, nextTurn(next, side), ctx.now, events), events };
    }
  }
}

/**
 * Final winner once the price-guess round is known (`roundsWon[side]` = rounds that side won).
 * Forfeit/abandon is decided already. Otherwise the puzzle result stands; only a still-tied match falls through to
 * the price-guess rounds, and a locked-out side cannot win off them while the other side is still in
 * (game-rules.md §Price-guess bonus points). Returns null for a draw.
 */
export function resolveWinner(state: MatchState, roundsWon: readonly [number, number]): MatchSide | null {
  if (!state.result) throw new Error('resolveWinner: the match is not finished');
  if (state.result.reason === 'forfeit' || state.result.reason === 'abandon') return state.result.winner;
  if (state.result.winner !== null) return state.result.winner;
  if (roundsWon[0] === roundsWon[1]) return null;
  const leader: MatchSide = roundsWon[0] > roundsWon[1] ? 0 : 1;
  if (state.lockedOut[leader] && !state.lockedOut[otherSide(leader)]) return null;
  return leader;
}

/** Final tallies for the result screen: a locked-out side that stayed gets the small per-round bonus. */
export function finalScores(state: MatchState, roundsWon: readonly [number, number]): [number, number] {
  const bonus = (side: MatchSide) => (state.lockedOut[side] ? roundsWon[side] * PRICE_GUESS_LOSER_BONUS_PER_ROUND : 0);
  return [state.scores[0] + bonus(0), state.scores[1] + bonus(1)];
}

export interface MatchClientView {
  /** The viewer's own side. */
  you: MatchSide;
  cards: readonly string[];
  /** Solved groups; before the match ends these are only groups somebody actually solved or the last auto-revealed one. */
  solved: readonly MatchSolvedGroup[];
  scores: readonly [number, number];
  mistakes: readonly [number, number];
  lockedOut: readonly [boolean, boolean];
  turn: MatchSide;
  turnId: number;
  /** Absolute ms timestamp when the active turn times out. */
  turnEndsAt: number;
  status: 'playing' | 'finished';
  result: MatchResult | null;
}

/**
 * The ONLY shape of match state that may leave the server (rule 4): unsolved groups, their texts and any
 * price are simply not representable here. Each side sees the same board; in-progress selections are never in state.
 */
export function matchClientView(state: MatchState, viewerId: string): MatchClientView | null {
  const you = sideOf(state, viewerId);
  if (you === null) return null;
  return {
    you,
    cards: state.remaining,
    solved: state.solved,
    scores: state.scores,
    mistakes: state.mistakes,
    lockedOut: state.lockedOut,
    turn: state.turn,
    turnId: state.turnId,
    turnEndsAt: turnDeadline(state),
    status: state.status,
    result: state.result,
  };
}
