import { RANDOM_TOPIC, THEMED_MATCH_MIN_ROUNDS } from '../config/topics.js';
import type { Rng } from '../game/rng.js';
import { openTopics, resolveTopicPick, topicChooserForRound } from './pick.js';
import type { TopicChooser } from './pick.js';

/**
 * The topic draft of a themed duel or table (docs/logic/themed-rounds.md): before the first board the sides take turns naming the
 * topic of each round, a topic closes once used, «random» draws one, and the last round of an odd count is the system's draw.
 * Pure: time and randomness come in from outside.
 */
export interface DraftState {
  rounds: number;
  /** Every topic on offer for this match (ids). */
  pool: readonly string[];
  firstChooser: 0 | 1;
  /** Topic of each round settled so far, in round order, and who settled it (a side, or the system / a timeout). */
  picks: readonly { topic: string; by: TopicChooser | 'timeout' }[];
  status: 'picking' | 'done';
}

export type DraftError = 'NOT_YOUR_PICK' | 'UNKNOWN_TOPIC' | 'DRAFT_DONE';

/** The round now being named (0-based) and who names it; null once everything is settled. */
export const draftTurn = (s: DraftState): { round: number; chooser: TopicChooser } | null =>
  s.status === 'done' ? null : { round: s.picks.length, chooser: topicChooserForRound(s.picks.length + 1, s.rounds, s.firstChooser) };

/** Topics still open to pick. */
export const draftOpen = (s: DraftState): string[] => openTopics(s.pool, s.picks.map((p) => p.topic));

/** Settles every consecutive round that belongs to the system (the last round of an odd count). */
function settleSystem(s: DraftState, rng: Rng): DraftState {
  let state = s;
  for (;;) {
    const turn = draftTurn(state);
    if (!turn || turn.chooser !== 'system') return state;
    const topic = resolveTopicPick(null, draftOpen(state), rng);
    if (topic === null) throw new Error('the draft ran out of topics');
    state = push(state, topic, 'system');
  }
}

function push(s: DraftState, topic: string, by: TopicChooser | 'timeout'): DraftState {
  const picks = [...s.picks, { topic, by }];
  return { ...s, picks, status: picks.length >= s.rounds ? 'done' : 'picking' };
}

/** Starts a draft. Needs at least as many topics as rounds (a topic is never used twice in one match). */
export function startDraft(pool: readonly string[], rounds: number, firstChooser: 0 | 1, rng: Rng): DraftState {
  if (!Number.isInteger(rounds) || rounds < THEMED_MATCH_MIN_ROUNDS) throw new RangeError('rounds below the minimum');
  if (new Set(pool).size < rounds) throw new RangeError('fewer topics than rounds');
  return settleSystem({ rounds, pool: [...new Set(pool)], firstChooser, picks: [], status: 'picking' }, rng);
}

/** A side names the topic of the round in play (an id, or `random`). */
export function applyDraftPick(s: DraftState, side: 0 | 1, pick: string, rng: Rng): DraftState | { error: DraftError } {
  const turn = draftTurn(s);
  if (!turn) return { error: 'DRAFT_DONE' };
  if (turn.chooser !== side) return { error: 'NOT_YOUR_PICK' };
  const topic = pick === RANDOM_TOPIC ? resolveTopicPick(RANDOM_TOPIC, draftOpen(s), rng) : resolveTopicPick(pick, draftOpen(s), rng);
  if (topic === null) return { error: 'UNKNOWN_TOPIC' };
  return settleSystem(push(s, topic, side), rng);
}

/** The chooser ran out of time (or left): the round gets a random open topic. */
export function expireDraftPick(s: DraftState, rng: Rng): DraftState {
  const turn = draftTurn(s);
  if (!turn) return s;
  const topic = resolveTopicPick(null, draftOpen(s), rng);
  if (topic === null) throw new Error('the draft ran out of topics');
  return settleSystem(push(s, topic, 'timeout'), rng);
}
