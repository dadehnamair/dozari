import { trackRules } from '@dozari/shared';
import type { AgeTrack, QueueProblem } from '@dozari/shared';

export interface DiagnoseDeps {
  /** True when at least one approved puzzle of these pools (the waiting player's age track) can be served. */
  hasPuzzle(tracks: readonly AgeTrack[]): Promise<boolean>;
  /** True when a bot could be paired with a waiting human (bots on and at least one idle-capable account). */
  botsReady(): boolean;
  /** Seconds a player waits before a missing bot is worth reporting (a real opponent may still arrive). */
  graceSec: number;
  now?: () => number;
  /** How long a "has puzzles" answer is reused, so a queue of waiters costs one lookup, not one each. */
  cacheMs?: number;
}

/**
 * Why a waiting player is stuck (shown on the search screen instead of an endless spinner): no puzzle at all, or — after the grace
 * period — nobody to play against because no bot account exists or bots are off.
 */
export function createQueueDiagnosis(deps: DiagnoseDeps): (waitedSec: number, track?: AgeTrack) => Promise<QueueProblem | null> {
  const now = deps.now ?? Date.now;
  const cacheMs = deps.cacheMs ?? 20_000;
  const seen = new Map<AgeTrack, { at: number; ok: boolean }>();
  return async (waitedSec, track = 'adult') => {
    let hit = seen.get(track);
    if (!hit || now() - hit.at >= cacheMs) {
      hit = { ok: await deps.hasPuzzle(trackRules(track).puzzleTracks), at: now() };
      seen.set(track, hit);
    }
    if (!hit.ok) return 'no_puzzles';
    if (waitedSec >= deps.graceSec && !deps.botsReady()) return 'no_bots';
    return null;
  };
}
