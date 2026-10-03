import type { QueueProblem } from '@dozari/shared';

export interface DiagnoseDeps {
  /** True when at least one approved puzzle can be served. */
  hasPuzzle(): Promise<boolean>;
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
export function createQueueDiagnosis(deps: DiagnoseDeps): (waitedSec: number) => Promise<QueueProblem | null> {
  const now = deps.now ?? Date.now;
  const cacheMs = deps.cacheMs ?? 20_000;
  let at = -Infinity;
  let puzzle = true;
  return async (waitedSec) => {
    if (now() - at >= cacheMs) {
      puzzle = await deps.hasPuzzle();
      at = now();
    }
    if (!puzzle) return 'no_puzzles';
    if (waitedSec >= deps.graceSec && !deps.botsReady()) return 'no_bots';
    return null;
  };
}
