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

/** Up to `count` different questions from the pool, never one in `exclude`. */
export function pickTriviaQuestions(pool: readonly TriviaQuestion[], count: number, rng: Rng, exclude: ReadonlySet<string> = new Set()): TriviaQuestion[] {
  return shuffled(pool.filter((q) => !exclude.has(q.id)), rng).slice(0, Math.max(0, count));
}
