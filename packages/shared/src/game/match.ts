import {
  FIRST_BLOOD_BONUS,
  GROUP_COUNT,
  GROUP_POINTS,
  GROUP_SIZE,
  FREEZE_SECONDS,
  MATCH_FREEZES,
  MATCH_MAGNIFIERS,
  MATCH_MAX_MISTAKES,
  POWERS_PER_PLAYER,
  SHOP_ITEM_USES_PER_MATCH,
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
 * commands carrying the `turnId` they were scheduled for. A side is one player (1v1) or two teammates (2v2):
 * the team shares one turn, score and mistake counter; the turn's captain submits and the captain rotates every turn.
 */

export type MatchSide = 0 | 1;
export type PowerKind = 'magnifier' | 'freeze' | 'shuffle' | 'reveal';
/** The two kinds bought in the shop (stock comes from the player's inventory when the match starts). */
export type ItemKind = 'shuffle' | 'reveal';
export const ITEM_KINDS: readonly ItemKind[] = ['shuffle', 'reveal'];
export type ItemCounts = Record<ItemKind, number>;
export interface PowerCounts {
  magnifier: number;
  freeze: number;
}
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

/** The tunable numbers of a match, frozen when it starts so an admin edit never changes a game in progress. */
export interface MatchRules {
  turnSeconds: number;
  /** Lock-out limit per side per board. */
  maxMistakes: number;
  /** Consecutive timeouts that make a side forfeit. */
  maxTimeouts: number;
  /** Points for a group, yellow to purple. */
  groupPoints: readonly number[];
  firstBloodBonus: number;
  /** Power-ups each side may use per match (the shared defaults when absent). */
  magnifiers?: number;
  freezes?: number;
  freezeSeconds?: number;
  /** Each side plays its own board (same 16 cards, own order, own progress); the first to find all four groups wins the board. See docs/logic/themed-rounds.md. */
  separateBoards?: boolean;
}

export const DEFAULT_MATCH_RULES: MatchRules = {
  turnSeconds: TURN_SECONDS,
  maxMistakes: MATCH_MAX_MISTAKES,
  maxTimeouts: MAX_CONSECUTIVE_TIMEOUTS,
  groupPoints: GROUP_POINTS,
  firstBloodBonus: FIRST_BLOOD_BONUS,
  magnifiers: MATCH_MAGNIFIERS,
  freezes: MATCH_FREEZES,
};

export interface SeparateBoards {
  remaining: readonly [readonly string[], readonly string[]];
  solved: readonly [readonly MatchSolvedGroup[], readonly MatchSolvedGroup[]];
  tried: readonly [readonly string[], readonly string[]];
}

export interface MatchState {
  /** The numbers this match plays by (admin settings at the moment it started; the shared config by default). */
  rules: MatchRules;
  /** The board in play (of `rounds`; a 2v2 plays several). The solution. Server-side only; `matchClientView` is the only thing that may leave the server. */
  puzzle: SoloPuzzle;
  /** 2 players (1v1) or 4 (2v2: two per side). */
  players: readonly MatchPlayer[];
  /** The player who may submit for each side right now. */
  captain: readonly [string, string];
  /** Players who left; their team carries on without them, and a side with nobody left forfeits. */
  gone: readonly string[];
  /** Boards still to come, with their card order already shuffled (the reducer holds no rng); `order1` is side 1's own order in separate-boards mode. */
  upcoming: readonly { puzzle: SoloPuzzle; order: readonly string[]; order1?: readonly string[] }[];
  /** Separate-boards mode only: each side's own remaining cards, found groups and tried sets (`remaining`/`solved`/`tried` then hold side 0's view and are not used for play). */
  sep?: SeparateBoards;
  /** Boards each side has won (separate-boards mode); decides the match. */
  boardsWon: readonly [number, number];
  /** 0-based index of the board in play, and how many boards the match has. */
  round: number;
  rounds: number;
  /** Who opened the board in play; the next board is opened by the other side. */
  boardStarter: MatchSide;
  /** Mistakes made on earlier boards (the lock-out limit is per board; tie-breaks count all). */
  mistakesBefore: readonly [number, number];
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
  /** Power-ups each side has left (magnifier, freeze), and how many magnifiers each side already used (picks the next group to peek at). */
  powers: readonly [PowerCounts, PowerCounts];
  magnified: readonly [number, number];
  /** Bought items each player holds for this match (a snapshot of the inventory at the start, counted down on use), and who used which (`userId:kind`). */
  itemCounts: Readonly<Record<string, ItemCounts>>;
  itemUsed: readonly string[];
  /** Players who already used a power-up: each player may use only one in a whole match, whatever the kind or how many they have. */
  powerUsers: readonly string[];
  /** Until when (ms) each side cannot select or submit because the rival froze it; 0 = not frozen. Cleared when a turn starts. */
  frozenUntil: readonly [number, number];
  turn: MatchSide;
  /** Bumps on every turn (re)start; a timeout for an older id is stale. */
  turnId: number;
  turnStartedAt: number;
  status: 'playing' | 'finished';
  result: MatchResult | null;
}

export type Command =
  | { t: 'submit'; by: string; itemIds: readonly string[] }
  /** Team only, never stored: a teammate shows the captain a selection. */
  | { t: 'propose'; by: string; itemIds: readonly string[] }
  | { t: 'timeout'; turnId: number }
  | { t: 'leave'; by: string }
  /** The captain of the side to play uses a power-up (no turn, mistake or clock change). */
  | { t: 'power'; by: string; kind: PowerKind; /** `shuffle`: the new order of the rival's remaining cards (the reducer holds no rng). */ order?: readonly string[] }
  | { t: 'forfeit'; side: MatchSide };

export type RuleError =
  | 'MATCH_FINISHED'
  | 'UNKNOWN_PLAYER'
  | 'NOT_YOUR_TURN'
  | 'NOT_CAPTAIN'
  | 'NOT_TEAM_MATCH'
  | 'INVALID_SELECTION'
  | 'DUPLICATE_SELECTION'
  | 'NO_POWER'
  /** This player already used their one power-up of the match. */
  | 'POWER_USED'
  /** The side is frozen: it cannot select or submit until the freeze ends. */
  | 'FROZEN';

export type SubmitFeedback = 'correct' | 'one_away' | 'wrong';

export type MatchEvent =
  | { t: 'guess'; side: MatchSide; itemIds: readonly string[]; outcome: SubmitFeedback }
  /** Service-made: the group `userId` just solved held the board's gem card. */
  | { t: 'gem'; userId: string; amount: number }
  | { t: 'group_solved'; side: MatchSide; level: GroupLevel; points: number; firstBlood: boolean }
  | { t: 'group_revealed'; level: GroupLevel }
  /** Separate-boards mode: `side` now has `count` of 4 groups. This is the only progress the rival may learn (the service drops guess/group_solved for them). */
  | { t: 'found'; side: MatchSide; count: number }
  /** A board of a multi-board match is over (its solution may now be shown); the next one follows. */
  | { t: 'board_done'; round: number }
  | { t: 'board'; round: number; rounds: number }
  | { t: 'locked_out'; side: MatchSide }
  | { t: 'timeout'; side: MatchSide }
  /** A power-up was used. `itemIds` (the magnifier's two cards) is for the user's own side only: the service strips it for the rival. */
  | { t: 'power'; side: MatchSide; kind: PowerKind; itemIds?: readonly string[]; /** Freeze: when the rival may act again (ms). */ until?: number }
  | { t: 'turn'; side: MatchSide; turnId: number; captain: string }
  /** Visible to the proposer's teammate only (the service must not broadcast it to the other side). */
  | { t: 'proposal'; side: MatchSide; by: string; itemIds: readonly string[] }
  | { t: 'captain'; side: MatchSide; userId: string }
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
  rules?: MatchRules,
): MatchState {
  return startTeamMatch(puzzle, [[players[0]], [players[1]]], rng, now, startingSide, rules);
}

/**
 * `sides[s]` = the player ids of side `s`: one (1v1) or two (2v2); both sides the same size.
 * `puzzle` is one board, or a list of them for a multi-board match (2v2).
 */
export function startTeamMatch(
  puzzle: SoloPuzzle | readonly SoloPuzzle[],
  sides: readonly [readonly string[], readonly string[]],
  rng: Rng,
  now: number,
  startingSide?: MatchSide,
  rules: MatchRules = DEFAULT_MATCH_RULES,
  items: Readonly<Record<string, ItemCounts>> = {},
): MatchState {
  const size = sides[0].length;
  if ((size !== 1 && size !== 2) || sides[1].length !== size) throw new Error('a match is 1v1 or 2v2');
  const all = [...sides[0], ...sides[1]];
  if (new Set(all).size !== all.length) throw new Error('a match needs different players');
  const boards: readonly SoloPuzzle[] = 'groups' in puzzle ? [puzzle] : puzzle;
  if (boards.length === 0) throw new Error('a match needs a board');
  const first = boards[0] as SoloPuzzle;
  const turn: MatchSide = startingSide ?? (rng() < 0.5 ? 0 : 1);
  const separate = rules.separateBoards === true;
  const upcoming = boards.slice(1).map((p) => {
    const order = initialBoardOrder(p, rng);
    return separate ? { puzzle: p, order, order1: initialBoardOrder(p, rng) } : { puzzle: p, order };
  });
  const order0 = initialBoardOrder(first, rng);
  const order1 = separate ? initialBoardOrder(first, rng) : order0;
  return {
    rules,
    puzzle: first,
    upcoming,
    ...(separate ? { sep: { remaining: [order0, order1] as const, solved: [[], []] as const, tried: [[], []] as const } } : {}),
    boardsWon: [0, 0],
    round: 0,
    rounds: boards.length,
    boardStarter: turn,
    mistakesBefore: [0, 0],
    players: [...sides[0].map((userId) => ({ userId, side: 0 as const })), ...sides[1].map((userId) => ({ userId, side: 1 as const }))],
    captain: [sides[0][0]!, sides[1][0]!],
    gone: [],
    remaining: order0,
    solved: [],
    scores: [0, 0],
    mistakes: [0, 0],
    lockedOut: [false, false],
    timeouts: [0, 0],
    lastCorrectAt: [null, null],
    tried: [],
    powers: [0, 1].map(() => ({ magnifier: rules.magnifiers ?? MATCH_MAGNIFIERS, freeze: rules.freezes ?? MATCH_FREEZES })) as unknown as readonly [PowerCounts, PowerCounts],
    magnified: [0, 0],
    itemCounts: items,
    itemUsed: [],
    powerUsers: [],
    frozenUntil: [0, 0],
    turn,
    turnId: 1,
    turnStartedAt: now,
    status: 'playing',
    result: null,
  };
}

/** Players of a side who are still in the match, in seat order. */
export const presentOf = (state: MatchState, side: MatchSide): string[] =>
  state.players.filter((p) => p.side === side && !state.gone.includes(p.userId)).map((p) => p.userId);

export const isTeamMatch = (state: MatchState): boolean => state.players.length > 2;

const set = <T>(pair: readonly [T, T], side: MatchSide, value: T): [T, T] => (side === 0 ? [value, pair[1]] : [pair[0], value]);

const remainingOf = (state: MatchState, side: MatchSide): readonly string[] => (state.sep ? state.sep.remaining[side] : state.remaining);
const solvedOf = (state: MatchState, side: MatchSide): readonly MatchSolvedGroup[] => (state.sep ? state.sep.solved[side] : state.solved);
const triedOf = (state: MatchState, side: MatchSide): readonly string[] => (state.sep ? state.sep.tried[side] : state.tried);

export const turnDeadline = (state: MatchState): number => state.turnStartedAt + state.rules.turnSeconds * 1000;

export function sideOf(state: MatchState, userId: string): MatchSide | null {
  return state.players.find((p) => p.userId === userId)?.side ?? null;
}

function revealRest(state: MatchState, events: MatchEvent[]): MatchState {
  if (state.sep) return state; // separate boards: nothing is revealed mid-match; the service sends the solution once the board is over
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
  if (state.sep && state.boardsWon[0] !== state.boardsWon[1]) return state.boardsWon[0] > state.boardsWon[1] ? 0 : 1;
  const [s0, s1] = state.scores;
  if (s0 !== s1) return s0 > s1 ? 0 : 1;
  const m0 = state.mistakes[0] + state.mistakesBefore[0];
  const m1 = state.mistakes[1] + state.mistakesBefore[1];
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

/** Separate boards: who takes the board. The finisher; if both sides locked out, whoever found more groups, then made fewer mistakes; otherwise nobody. */
function scoreBoard(state: MatchState, finisher: MatchSide | undefined): readonly [number, number] {
  let winner: MatchSide | null = finisher ?? null;
  if (winner === null && state.sep) {
    const [a, b] = [state.sep.solved[0].length, state.sep.solved[1].length];
    if (a !== b) winner = a > b ? 0 : 1;
    else if (state.mistakes[0] !== state.mistakes[1]) winner = state.mistakes[0] < state.mistakes[1] ? 0 : 1;
  }
  if (winner === null) return state.boardsWon;
  return set(state.boardsWon, winner, state.boardsWon[winner] + 1);
}

/**
 * A board is over by `reason` (`solved` = three groups found, `locked_out` = both sides out). The last board ends the match;
 * an earlier one reveals its rest and opens the next board for the side that did not open this one.
 */
function endBoard(state: MatchState, reason: 'solved' | 'locked_out', now: number, events: MatchEvent[], finisher?: MatchSide): MatchState {
  if (state.sep) state = { ...state, boardsWon: scoreBoard(state, finisher) };
  const [coming, ...rest] = state.upcoming;
  if (!coming) return finish(state, reason, decide(state), events);
  const shown = revealRest(state, events);
  events.push({ t: 'board_done', round: state.round });
  const starter = otherSide(state.boardStarter);
  const next: MatchState = {
    ...shown,
    puzzle: coming.puzzle,
    remaining: coming.order,
    ...(state.sep ? { sep: { remaining: [coming.order, coming.order1 ?? coming.order] as const, solved: [[], []] as const, tried: [[], []] as const } } : {}),
    upcoming: rest,
    round: state.round + 1,
    boardStarter: starter,
    solved: [],
    tried: [],
    mistakesBefore: [state.mistakesBefore[0] + state.mistakes[0], state.mistakesBefore[1] + state.mistakes[1]],
    mistakes: [0, 0],
    lockedOut: [false, false],
    timeouts: [0, 0],
  };
  events.push({ t: 'board', round: next.round, rounds: next.rounds });
  return startTurn(next, starter, now, events);
}

/**
 * Starts the next turn for `side` (also used to restart the clock when the same side keeps playing). The captain
 * rotates to the next present teammate unless the side is on a streak (`rotate: false`, after a correct guess).
 */
function startTurn(state: MatchState, side: MatchSide, now: number, events: MatchEvent[], rotate = true): MatchState {
  const turnId = state.turnId + 1;
  const present = presentOf(state, side);
  let captain = state.captain[side];
  if (rotate && present.length > 1) captain = present[(present.indexOf(captain) + 1) % present.length]!;
  else if (!present.includes(captain)) captain = present[0] ?? captain;
  events.push({ t: 'turn', side, turnId, captain });
  return { ...state, turn: side, turnId, turnStartedAt: now, frozenUntil: [0, 0], captain: set(state.captain, side, captain) };
}

/** Who plays next after `side` just moved: the opponent, unless the opponent is locked out. */
const nextTurn = (state: MatchState, side: MatchSide): MatchSide => (state.lockedOut[otherSide(side)] ? side : otherSide(side));

function forfeit(state: MatchState, side: MatchSide, reason: 'forfeit' | 'abandon', events: MatchEvent[]): MatchState {
  return finish(state, reason, otherSide(side), events);
}

/** A guess in separate-boards mode: it only touches the guesser's own board. Three found groups complete the board (the fourth is the cards left), and the first side to do so takes it. */
function submitSeparate(state: MatchState, side: MatchSide, ids: readonly string[], key: string, now: number, events: MatchEvent[]): MatchState {
  const sep = state.sep!;
  const chosen = new Set(ids);
  const done = new Set(sep.solved[side].map((g) => g.level));
  const open = state.puzzle.groups.filter((g) => !done.has(g.level));
  const exact = open.find((g) => g.productIds.every((id) => chosen.has(id)));
  const setSep = (patch: Partial<{ remaining: readonly string[]; solved: readonly MatchSolvedGroup[]; tried: readonly string[] }>): SeparateBoards => ({
    remaining: set(sep.remaining, side, patch.remaining ?? sep.remaining[side]),
    solved: set(sep.solved, side, patch.solved ?? sep.solved[side]),
    tried: set(sep.tried, side, patch.tried ?? sep.tried[side]),
  });
  let next: MatchState = { ...state, timeouts: set(state.timeouts, side, 0), sep: setSep({ tried: [...sep.tried[side], key] }) };

  if (exact) {
    events.push({ t: 'guess', side, itemIds: ids, outcome: 'correct' });
    const points = state.rules.groupPoints[exact.level] ?? 0;
    let solved: MatchSolvedGroup[] = [...sep.solved[side], { level: exact.level, productIds: exact.productIds, by: side }];
    let remaining = sep.remaining[side].filter((id) => !chosen.has(id));
    events.push({ t: 'group_solved', side, level: exact.level, points, firstBlood: false });
    next = { ...next, scores: set(next.scores, side, next.scores[side] + points), lastCorrectAt: set(next.lastCorrectAt, side, now) };
    if (solved.length === GROUP_COUNT - 1) {
      // The last group is the four cards left: it counts as found.
      const last = state.puzzle.groups.find((g) => !solved.some((x) => x.level === g.level))!;
      solved = [...solved, { level: last.level, productIds: last.productIds, by: side }];
      remaining = [];
    }
    next = { ...next, sep: { ...next.sep!, remaining: set(next.sep!.remaining, side, remaining), solved: set(next.sep!.solved, side, solved) } };
    events.push({ t: 'found', side, count: solved.length });
    if (solved.length === GROUP_COUNT) return endBoard(next, 'solved', now, events, side);
    return startTurn(next, side, now, events, false); // a correct guess keeps the turn
  }

  const oneAway = open.some((g) => g.productIds.filter((id) => chosen.has(id)).length === GROUP_SIZE - 1);
  events.push({ t: 'guess', side, itemIds: ids, outcome: oneAway ? 'one_away' : 'wrong' });
  const mistakes = next.mistakes[side] + 1;
  next = { ...next, mistakes: set(next.mistakes, side, mistakes) };
  if (mistakes >= state.rules.maxMistakes) {
    next = { ...next, lockedOut: set(next.lockedOut, side, true) };
    events.push({ t: 'locked_out', side });
    if (next.lockedOut[otherSide(side)]) return endBoard(next, 'locked_out', now, events);
  }
  return startTurn(next, nextTurn(next, side), now, events);
}

/**
 * A bought item (docs/logic/shop-match-items.md). It does not touch the turn, the clock or the free power-up of the match.
 * `shuffle` re-orders the rival's remaining cards (separate-boards mode only; `order` is the new order, supplied by the service);
 * `reveal` shows the user's own side the four cards of one group they have not found yet (on their own turn, captain only).
 */
function applyItem(state: MatchState, side: MatchSide, by: string, kind: ItemKind, order: readonly string[] | undefined, events: MatchEvent[]): ApplyResult {
  const have = state.itemCounts[by]?.[kind] ?? 0;
  if (have <= 0) return { error: 'NO_POWER' };
  const key = `${by}:${kind}`;
  if (state.itemUsed.filter((k) => k === key).length >= SHOP_ITEM_USES_PER_MATCH) return { error: 'POWER_USED' };
  const spent = { itemCounts: { ...state.itemCounts, [by]: { ...(state.itemCounts[by] as ItemCounts), [kind]: have - 1 } }, itemUsed: [...state.itemUsed, key] };

  if (kind === 'shuffle') {
    const target = otherSide(side);
    if (!state.sep || state.lockedOut[target]) return { error: 'NO_POWER' };
    const current = state.sep.remaining[target];
    if (!order || order.length !== current.length || new Set(order).size !== order.length || order.some((id) => !current.includes(id))) return { error: 'INVALID_SELECTION' };
    events.push({ t: 'power', side, kind });
    return { state: { ...state, ...spent, sep: { ...state.sep, remaining: set(state.sep.remaining, target, order) } }, events };
  }

  if (side !== state.turn) return { error: 'NOT_YOUR_TURN' };
  if (state.captain[side] !== by) return { error: 'NOT_CAPTAIN' };
  const done = new Set(solvedOf(state, side).map((g) => g.level));
  const group = [...state.puzzle.groups].sort((a, b) => a.level - b.level).find((g) => !done.has(g.level));
  if (!group) return { error: 'NO_POWER' };
  events.push({ t: 'power', side, kind, itemIds: group.productIds });
  return { state: { ...state, ...spent }, events };
}

export function applyCommand(state: MatchState, cmd: Command, ctx: Ctx): ApplyResult {
  if (state.status === 'finished') return { error: 'MATCH_FINISHED' };
  const events: MatchEvent[] = [];

  switch (cmd.t) {
    case 'forfeit':
      return { state: forfeit(state, cmd.side, 'forfeit', events), events };

    case 'leave': {
      const side = sideOf(state, cmd.by);
      if (side === null || state.gone.includes(cmd.by)) return { error: 'UNKNOWN_PLAYER' };
      let next: MatchState = { ...state, gone: [...state.gone, cmd.by] };
      const left = presentOf(next, side);
      if (left.length === 0) return { state: forfeit(next, side, 'abandon', events), events };
      // The team carries on with the teammate; if the leaver was the captain the teammate takes over.
      if (next.captain[side] === cmd.by) {
        next = { ...next, captain: set(next.captain, side, left[0]!) };
        events.push({ t: 'captain', side, userId: left[0]! });
      }
      return { state: next, events };
    }

    case 'timeout': {
      if (cmd.turnId !== state.turnId) return { state, events }; // stale timer: ignored
      const side = state.turn;
      events.push({ t: 'timeout', side });
      const count = state.timeouts[side] + 1;
      let next: MatchState = { ...state, timeouts: set(state.timeouts, side, count) };
      if (state.sep) {
        // Separate boards: running out of time costs the same as a wrong guess (a mistake, maybe the lock-out) but is told only to the
        // side that timed out, and it can never hand the rival a win: a board is won only by finding its groups.
        const mistakes = next.mistakes[side] + 1;
        next = { ...next, mistakes: set(next.mistakes, side, mistakes) };
        if (mistakes >= state.rules.maxMistakes) {
          next = { ...next, lockedOut: set(next.lockedOut, side, true) };
          events.push({ t: 'locked_out', side });
          if (next.lockedOut[otherSide(side)]) return { state: endBoard(next, 'locked_out', ctx.now, events), events };
        }
        return { state: startTurn(next, nextTurn(next, side), ctx.now, events), events };
      }
      if (count >= state.rules.maxTimeouts) return { state: forfeit(next, side, 'forfeit', events), events };
      next = startTurn(next, nextTurn(next, side), ctx.now, events);
      return { state: next, events };
    }

    case 'propose': {
      if (!isTeamMatch(state)) return { error: 'NOT_TEAM_MATCH' };
      const side = sideOf(state, cmd.by);
      if (side === null || state.gone.includes(cmd.by)) return { error: 'UNKNOWN_PLAYER' };
      if (side !== state.turn) return { error: 'NOT_YOUR_TURN' };
      if (state.frozenUntil[side] > ctx.now) return { error: 'FROZEN' };
      const onBoard = new Set(remainingOf(state, side));
      if (cmd.itemIds.length > GROUP_SIZE || new Set(cmd.itemIds).size !== cmd.itemIds.length || cmd.itemIds.some((id) => !onBoard.has(id))) {
        return { error: 'INVALID_SELECTION' };
      }
      events.push({ t: 'proposal', side, by: cmd.by, itemIds: cmd.itemIds });
      return { state, events };
    }

    case 'submit': {
      const side = sideOf(state, cmd.by);
      if (side === null || state.gone.includes(cmd.by)) return { error: 'UNKNOWN_PLAYER' };
      if (side !== state.turn) return { error: 'NOT_YOUR_TURN' };
      if (state.captain[side] !== cmd.by) return { error: 'NOT_CAPTAIN' };
      if (state.frozenUntil[side] > ctx.now) return { error: 'FROZEN' };
      const ids = cmd.itemIds;
      const onBoard = new Set(remainingOf(state, side));
      if (ids.length !== GROUP_SIZE || new Set(ids).size !== GROUP_SIZE || ids.some((id) => !onBoard.has(id))) {
        return { error: 'INVALID_SELECTION' };
      }
      const key = selectionKey(ids);
      if (triedOf(state, side).includes(key)) return { error: 'DUPLICATE_SELECTION' };
      if (state.sep) return { state: submitSeparate(state, side, ids, key, ctx.now, events), events };

      const chosen = new Set(ids);
      const done = new Set(state.solved.map((g) => g.level));
      const open = state.puzzle.groups.filter((g) => !done.has(g.level));
      const exact = open.find((g) => g.productIds.every((id) => chosen.has(id)));
      let next: MatchState = { ...state, tried: [...state.tried, key], timeouts: set(state.timeouts, side, 0) };

      if (exact) {
        events.push({ t: 'guess', side, itemIds: ids, outcome: 'correct' });
        const firstBlood = state.round === 0 && state.solved.length === 0;
        const points = (state.rules.groupPoints[exact.level] ?? 0) + (firstBlood ? state.rules.firstBloodBonus : 0);
        next = {
          ...next,
          remaining: next.remaining.filter((id) => !chosen.has(id)),
          solved: [...next.solved, { level: exact.level, productIds: exact.productIds, by: side }],
          scores: set(next.scores, side, next.scores[side] + points),
          lastCorrectAt: set(next.lastCorrectAt, side, ctx.now),
        };
        events.push({ t: 'group_solved', side, level: exact.level, points, firstBlood });
        if (next.solved.length === GROUP_COUNT - 1) {
          return { state: endBoard(next, 'solved', ctx.now, events), events };
        }
        // A correct guess keeps the turn (streak) with a fresh clock.
        return { state: startTurn(next, side, ctx.now, events, false), events };
      }

      const oneAway = open.some((g) => g.productIds.filter((id) => chosen.has(id)).length === GROUP_SIZE - 1);
      events.push({ t: 'guess', side, itemIds: ids, outcome: oneAway ? 'one_away' : 'wrong' });
      const mistakes = next.mistakes[side] + 1;
      next = { ...next, mistakes: set(next.mistakes, side, mistakes) };
      if (mistakes >= state.rules.maxMistakes) {
        next = { ...next, lockedOut: set(next.lockedOut, side, true) };
        events.push({ t: 'locked_out', side });
        if (next.lockedOut[otherSide(side)]) {
          return { state: endBoard(next, 'locked_out', ctx.now, events), events };
        }
      }
      return { state: startTurn(next, nextTurn(next, side), ctx.now, events), events };
    }

    case 'power': {
      const side = sideOf(state, cmd.by);
      if (side === null || state.gone.includes(cmd.by)) return { error: 'UNKNOWN_PLAYER' };
      if (cmd.kind === 'shuffle' || cmd.kind === 'reveal') return applyItem(state, side, cmd.by, cmd.kind, cmd.order, events);
      if (state.powerUsers.filter((id) => id === cmd.by).length >= POWERS_PER_PLAYER) return { error: 'POWER_USED' };
      const left = state.powers[side];
      if (cmd.kind === 'freeze') {
        // Used while the RIVAL plays: it cannot select or submit for a few seconds, its clock keeps running.
        const rival = otherSide(side);
        if (state.turn !== rival) return { error: 'NOT_YOUR_TURN' };
        if (left.freeze <= 0 || state.lockedOut[rival] || state.frozenUntil[rival] > ctx.now) return { error: 'NO_POWER' };
        const until = ctx.now + (state.rules.freezeSeconds ?? FREEZE_SECONDS) * 1000;
        events.push({ t: 'power', side, kind: 'freeze', until });
        return { state: { ...state, powers: set(state.powers, side, { ...left, freeze: left.freeze - 1 }), frozenUntil: set(state.frozenUntil, rival, until), powerUsers: [...state.powerUsers, cmd.by] }, events };
      }
      // Magnifier, on the user's own turn: two cards of one unsolved group; the next use looks at the next group, so two uses never repeat.
      if (side !== state.turn) return { error: 'NOT_YOUR_TURN' };
      if (state.captain[side] !== cmd.by) return { error: 'NOT_CAPTAIN' };
      if (left.magnifier <= 0) return { error: 'NO_POWER' };
      const done = new Set(solvedOf(state, side).map((g) => g.level));
      const open = state.puzzle.groups.filter((g) => !done.has(g.level));
      const group = open[state.magnified[side] % open.length];
      if (!group) return { error: 'NO_POWER' };
      const mine = remainingOf(state, side);
      const itemIds = group.productIds.filter((id) => mine.includes(id)).slice(0, 2);
      events.push({ t: 'power', side, kind: 'magnifier', itemIds });
      return { state: { ...state, powers: set(state.powers, side, { ...left, magnifier: left.magnifier - 1 }), magnified: set(state.magnified, side, state.magnified[side] + 1), powerUsers: [...state.powerUsers, cmd.by] }, events };
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
  const base = state.sep ? state.boardsWon : state.scores; // separate boards: the match score is boards won
  return [base[0] + bonus(0), base[1] + bonus(1)];
}

export interface MatchClientView {
  /** The viewer's own side. */
  you: MatchSide;
  /** Separate-boards mode: how many of 4 groups each side has (the rival's solutions are never in the view, only this count), and the boards each side won. */
  found?: readonly [number, number];
  boardsWon?: readonly [number, number];
  cards: readonly string[];
  /** Solved groups; before the match ends these are only groups somebody actually solved or the last auto-revealed one. */
  solved: readonly MatchSolvedGroup[];
  scores: readonly [number, number];
  mistakes: readonly [number, number];
  lockedOut: readonly [boolean, boolean];
  /** Board in play (0-based) and the number of boards of the match. */
  round: number;
  rounds: number;
  /** Bought items the viewer still holds in this match. */
  items: ItemCounts;
  /** The viewer's own power-ups left, and until when (ms) each side is frozen (0 = not). */
  powers: PowerCounts;
  /** The viewer already used their one power-up of this match. */
  powerUsed: boolean;
  frozenUntil: readonly [number, number];
  turn: MatchSide;
  /** Who submits for each side right now. */
  captain: readonly [string, string];
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
    ...(state.sep ? { found: [state.sep.solved[0].length, state.sep.solved[1].length] as const, boardsWon: state.boardsWon } : {}),
    cards: remainingOf(state, you),
    solved: solvedOf(state, you),
    scores: state.sep ? state.boardsWon : state.scores,
    mistakes: state.mistakes,
    lockedOut: state.lockedOut,
    round: state.round,
    rounds: state.rounds,
    items: { shuffle: state.itemCounts[viewerId]?.shuffle ?? 0, reveal: state.itemCounts[viewerId]?.reveal ?? 0 },
    powers: state.powers[you],
    powerUsed: state.powerUsers.filter((id) => id === viewerId).length >= POWERS_PER_PLAYER,
    frozenUntil: state.frozenUntil,
    turn: state.turn,
    captain: state.captain,
    turnId: state.turnId,
    turnEndsAt: turnDeadline(state),
    status: state.status,
    result: state.result,
  };
}
