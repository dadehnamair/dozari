import { RANDOM_TOPIC, THEMED_MATCH_MIN_ROUNDS } from '../config/topics.js';
import type { Rng } from '../game/rng.js';

/** Who names the topic of a round: a side index, or the system (the last round of an odd count). */
export type TopicChooser = 0 | 1 | 'system';

/**
 * Sides take turns choosing, starting with `firstChooser`. With an odd number of rounds the last
 * round is always the system's, so neither side gets two more picks than the other.
 */
export function topicChooserForRound(round: number, rounds: number, firstChooser: 0 | 1): TopicChooser {
  if (!Number.isInteger(rounds) || rounds < THEMED_MATCH_MIN_ROUNDS) throw new RangeError('rounds below the minimum');
  if (!Number.isInteger(round) || round < 1 || round > rounds) throw new RangeError('round out of range');
  if (rounds % 2 === 1 && round === rounds) return 'system';
  return ((firstChooser + round - 1) % 2) as 0 | 1;
}

/** Topics still open: a topic closes once chosen (by a side or by the draw) and never returns in the same match. */
export function openTopics(all: readonly string[], used: readonly string[]): string[] {
  const taken = new Set(used);
  return all.filter((t) => !taken.has(t));
}

/**
 * Resolves a pick to a concrete topic. `RANDOM_TOPIC` (and the system's turn, pick = null) draw from
 * the open topics. Returns null when a named topic is unknown or already closed, or nothing is left.
 */
export function resolveTopicPick(pick: string | null, open: readonly string[], rng: Rng): string | null {
  if (open.length === 0) return null;
  if (pick === null || pick === RANDOM_TOPIC) return open[Math.floor(rng() * open.length)] ?? null;
  return open.includes(pick) ? pick : null;
}
