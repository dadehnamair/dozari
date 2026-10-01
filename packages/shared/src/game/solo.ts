import { BOARD_SIZE, GROUP_COUNT, GROUP_SIZE, SOLO_MAX_MISTAKES } from '../config/index.js';
import { shuffled } from './rng.js';
import type { Rng } from './rng.js';

/** Difficulty/color level: 0 yellow .. 3 purple. */
export type GroupLevel = 0 | 1 | 2 | 3;

/** The solution. Server-side only: clients never receive this for unsolved groups (rule 4). */
export interface SoloPuzzle {
  groups: readonly { level: GroupLevel; productIds: readonly string[] }[];
}

export interface SolvedGroup {
  level: GroupLevel;
  productIds: readonly string[];
  /** true when the group was shown by the game (auto-reveal / game over), not found by the player. */
  revealed: boolean;
}

export type SoloStatus = 'playing' | 'won' | 'lost';

export interface SoloState {
  /** Products still on the board, in display order. */
  remaining: readonly string[];
  /** Groups taken off the board, in the order they were solved/revealed. */
  solved: readonly SolvedGroup[];
  mistakes: number;
  /** Canonical keys of every set already submitted (to reject repeats without penalty). */
  tried: readonly string[];
  status: SoloStatus;
}

export type SubmitOutcome =
  | 'correct'
  | 'one_away'
  | 'wrong'
  /** Same four items submitted before: no penalty. */
  | 'duplicate'
  /** Not exactly 4 distinct items on the board, or the game is over: nothing changes. */
  | 'invalid';

export interface SubmitResult {
  state: SoloState;
  outcome: SubmitOutcome;
  /** Set when the guess solved a group. */
  solvedLevel?: GroupLevel;
}

export const selectionKey = (ids: readonly string[]): string => [...ids].sort().join('|');

/** Shuffle the board so that no row of 4 consecutive cards is a whole group. */
function initialOrder(puzzle: SoloPuzzle, rng: Rng): string[] {
  const all = puzzle.groups.flatMap((g) => g.productIds);
  const groupKeys = new Set(puzzle.groups.map((g) => selectionKey(g.productIds)));
  for (let attempt = 0; attempt < 100; attempt++) {
    const order = shuffled(all, rng);
    let clean = true;
    for (let row = 0; row < GROUP_COUNT; row++) {
      if (groupKeys.has(selectionKey(order.slice(row * GROUP_SIZE, (row + 1) * GROUP_SIZE)))) clean = false;
    }
    if (clean) return order;
  }
  // 100 seeded reshuffles failing is astronomically unlikely; rotate rows deterministically instead.
  return all.map((_, i) => all[(i % GROUP_COUNT) * GROUP_SIZE + Math.floor(i / GROUP_COUNT)] as string);
}

export function startSolo(puzzle: SoloPuzzle, rng: Rng): SoloState {
  if (puzzle.groups.length !== GROUP_COUNT || puzzle.groups.some((g) => g.productIds.length !== GROUP_SIZE)) {
    throw new Error(`a puzzle needs ${GROUP_COUNT} groups of ${GROUP_SIZE}`);
  }
  const order = initialOrder(puzzle, rng);
  if (new Set(order).size !== BOARD_SIZE) throw new Error(`a puzzle needs ${BOARD_SIZE} distinct products`);
  return { remaining: order, solved: [], mistakes: 0, tried: [], status: 'playing' };
}

/** Reshuffle the cards still on the board (a UI convenience; never changes anything else). */
export function shuffleBoard(state: SoloState, rng: Rng): SoloState {
  if (state.status !== 'playing') return state;
  return { ...state, remaining: shuffled(state.remaining, rng) };
}

function takeOff(state: SoloState, group: SolvedGroup): Pick<SoloState, 'remaining' | 'solved'> {
  const ids = new Set(group.productIds);
  return { remaining: state.remaining.filter((id) => !ids.has(id)), solved: [...state.solved, group] };
}

/** Reveal every unsolved group, hardest-last by level, marking them as shown rather than found. */
function revealAll(state: SoloState, puzzle: SoloPuzzle): SoloState {
  let next = state;
  const solvedLevels = new Set(state.solved.map((g) => g.level));
  for (const g of [...puzzle.groups].sort((a, b) => a.level - b.level)) {
    if (solvedLevels.has(g.level)) continue;
    next = { ...next, ...takeOff(next, { level: g.level, productIds: g.productIds, revealed: true }) };
  }
  return next;
}

/**
 * Solo submission (docs/logic/game-rules.md): correct / one away / wrong, `SOLO_MAX_MISTAKES`
 * mistakes allowed, repeats rejected without penalty, last group auto-revealed once three are solved.
 * One away counts as a mistake like any wrong guess.
 */
export function submitGuess(
  state: SoloState,
  puzzle: SoloPuzzle,
  selection: readonly string[],
  maxMistakes: number = SOLO_MAX_MISTAKES,
): SubmitResult {
  const invalid = (): SubmitResult => ({ state, outcome: 'invalid' });
  if (state.status !== 'playing') return invalid();
  if (selection.length !== GROUP_SIZE || new Set(selection).size !== GROUP_SIZE) return invalid();
  const onBoard = new Set(state.remaining);
  if (selection.some((id) => !onBoard.has(id))) return invalid();

  const key = selectionKey(selection);
  if (state.tried.includes(key)) return { state, outcome: 'duplicate' };
  const tried = [...state.tried, key];

  const solvedLevels = new Set(state.solved.map((g) => g.level));
  const open = puzzle.groups.filter((g) => !solvedLevels.has(g.level));
  const chosen = new Set(selection);

  const exact = open.find((g) => g.productIds.every((id) => chosen.has(id)));
  if (exact) {
    let next: SoloState = { ...state, tried, ...takeOff(state, { level: exact.level, productIds: exact.productIds, revealed: false }) };
    if (next.solved.length === GROUP_COUNT - 1) next = revealAll(next, puzzle);
    if (next.solved.length === GROUP_COUNT) next = { ...next, status: 'won' };
    return { state: next, outcome: 'correct', solvedLevel: exact.level };
  }

  const oneAway = open.some((g) => g.productIds.filter((id) => chosen.has(id)).length === GROUP_SIZE - 1);
  const mistakes = state.mistakes + 1;
  let next: SoloState = { ...state, tried, mistakes };
  if (mistakes >= maxMistakes) next = { ...revealAll(next, puzzle), status: 'lost' };
  return { state: next, outcome: oneAway ? 'one_away' : 'wrong' };
}
