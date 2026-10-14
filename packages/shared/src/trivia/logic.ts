import type { Rng } from '../game/rng.js';
import { shuffled } from '../game/rng.js';

export interface TriviaQuestion {
  id: string;
  topicId: string;
  textFa: string;
  options: readonly string[];
  correctIndex: number;
  explanationFa: string;
}

/** The question with its choices in a new order; `correctIndex` is where the right one landed. Pure given the rng. */
export function shuffleTrivia(q: TriviaQuestion, rng: Rng): { options: string[]; correctIndex: number } {
  const order = shuffled(q.options.map((_, i) => i), rng);
  return { options: order.map((i) => q.options[i]!), correctIndex: order.indexOf(q.correctIndex) };
}

/**
 * Up to `count` different questions, the freshest first: those none of the `histories` (question id → when that player saw it, ms) contains,
 * then those seen by fewer players, then — among equals — the one seen longest ago. Ties are random (shuffled first), so a bank bigger than
 * the history never repeats and a small one cycles through its oldest questions instead of resetting. `avoid` (e.g. the game just played)
 * counts as seen by everybody, most recently. Pure given the rng.
 */
export function pickFreshTrivia(pool: readonly TriviaQuestion[], count: number, rng: Rng, histories: readonly ReadonlyMap<string, number>[], avoid: ReadonlySet<string> = new Set()): TriviaQuestion[] {
  const rank = (q: TriviaQuestion): [number, number] => {
    if (avoid.has(q.id)) return [histories.length + 1, Number.MAX_SAFE_INTEGER];
    let seenBy = 0;
    let latest = 0;
    for (const h of histories) {
      const at = h.get(q.id);
      if (at === undefined) continue;
      seenBy += 1;
      latest = Math.max(latest, at);
    }
    return [seenBy, latest];
  };
  const ranked = shuffled([...pool], rng).map((q) => ({ q, r: rank(q) }));
  // Array.prototype.sort is stable, so the shuffle decides among equal ranks.
  ranked.sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1]);
  return ranked.slice(0, Math.max(0, count)).map((x) => x.q);
}

/** Up to `count` different questions from the pool, never one in `exclude`. */
export function pickTriviaQuestions(pool: readonly TriviaQuestion[], count: number, rng: Rng, exclude: ReadonlySet<string> = new Set()): TriviaQuestion[] {
  return shuffled(pool.filter((q) => !exclude.has(q.id)), rng).slice(0, Math.max(0, count));
}
