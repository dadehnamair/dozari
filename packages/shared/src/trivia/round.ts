import { z } from 'zod';

/**
 * The general-question round of a duel or table (docs/logic/trivia.md §In a match): after the boards (and the price round, when there is one)
 * both sides answer the same N four-choice questions, blind and at the same time; a question closes when both have answered or its timer ends.
 * Each right answer is one point for that side. Pure: the server supplies the questions (choices already shuffled) and the clock.
 */

export type TriviaSide = 'a' | 'b';
export interface TriviaRoundQuestion {
  id: string;
  textFa: string;
  options: readonly string[];
  correctIndex: number;
  explanationFa: string;
  /** Nickname of the player who designed it (workshop). */
  authorFa?: string | null;
}
export interface TriviaRevealed {
  index: number;
  correctIndex: number;
  /** Picked choice per side; null = did not answer in time. */
  picks: { a: number | null; b: number | null };
}
export interface TriviaRoundState {
  questions: readonly TriviaRoundQuestion[];
  index: number;
  /** Picks for the question in play (hidden until it is revealed). */
  picked: { a: number | null; b: number | null };
  answered: { a: boolean; b: boolean };
  revealed: readonly TriviaRevealed[];
  status: 'playing' | 'finished';
}
export type TriviaCommand = { type: 'answer'; side: TriviaSide; index: number } | { type: 'timeout' };

export function startTriviaRound(questions: readonly TriviaRoundQuestion[]): TriviaRoundState {
  if (questions.length === 0) throw new Error('a trivia round needs a question');
  return { questions, index: 0, picked: { a: null, b: null }, answered: { a: false, b: false }, revealed: [], status: 'playing' };
}

function reveal(s: TriviaRoundState): TriviaRoundState {
  const q = s.questions[s.index]!;
  const revealed = [...s.revealed, { index: s.index, correctIndex: q.correctIndex, picks: { ...s.picked } }];
  const last = s.index + 1 >= s.questions.length;
  return { ...s, revealed, index: last ? s.index : s.index + 1, picked: { a: null, b: null }, answered: { a: false, b: false }, status: last ? 'finished' : 'playing' };
}

/** A second answer to the same question is ignored (returns the same state object); a timeout reveals whatever is in. */
export function applyTriviaCommand(s: TriviaRoundState, cmd: TriviaCommand): TriviaRoundState {
  if (s.status !== 'playing') return s;
  if (cmd.type === 'timeout') return reveal(s);
  if (s.answered[cmd.side] || !Number.isInteger(cmd.index) || cmd.index < 0 || cmd.index > 3) return s;
  const next: TriviaRoundState = { ...s, picked: { ...s.picked, [cmd.side]: cmd.index }, answered: { ...s.answered, [cmd.side]: true } };
  return next.answered.a && next.answered.b ? reveal(next) : next;
}

/** Right answers per side so far: one point each. */
export function triviaPoints(s: TriviaRoundState): [number, number] {
  const p: [number, number] = [0, 0];
  for (const r of s.revealed) {
    if (r.picks.a === r.correctIndex) p[0] += 1;
    if (r.picks.b === r.correctIndex) p[1] += 1;
  }
  return p;
}

/** The side with more right answers wins; equal points are a draw (null). */
export function triviaWinner(points: readonly [number, number]): 0 | 1 | null {
  return points[0] === points[1] ? null : points[0] > points[1] ? 0 : 1;
}

export const triviaRoundViewSchema = z.object({
  roundIndex: z.number().int().nonnegative(),
  totalRounds: z.number().int().positive(),
  /** The question in play; never carries the right choice. */
  current: z.object({ textFa: z.string(), options: z.array(z.string()).length(4) }).nullable(),
  youAnswered: z.boolean(),
  /** A fact (the opponent locked in), not the choice. */
  opponentAnswered: z.boolean(),
  /** Absolute epoch ms when the question is revealed whether or not everybody answered. */
  endsAt: z.number().int(),
  revealed: z.array(z.object({ index: z.number().int().nonnegative(), textFa: z.string(), options: z.array(z.string()).length(4), correctIndex: z.number().int().min(0).max(3), explanationFa: z.string(), authorFa: z.string().nullable().default(null), yourPick: z.number().int().min(0).max(3).nullable(), opponentPick: z.number().int().min(0).max(3).nullable() })),
});
export type TriviaRoundView = z.infer<typeof triviaRoundViewSchema>;

export const triviaSubmitSchema = z.object({ index: z.number().int().min(0).max(3) });
export type TriviaSubmit = z.infer<typeof triviaSubmitSchema>;

/** Wire form for one side: the opponent's choice and the right one stay hidden until the question is revealed. */
export function toTriviaRoundView(s: TriviaRoundState, viewer: TriviaSide, endsAt: number): TriviaRoundView {
  const other: TriviaSide = viewer === 'a' ? 'b' : 'a';
  const q = s.questions[s.index];
  return {
    roundIndex: Math.min(s.index, s.questions.length - 1),
    totalRounds: s.questions.length,
    current: s.status === 'playing' && q ? { textFa: q.textFa, options: [...q.options] } : null,
    youAnswered: s.answered[viewer],
    opponentAnswered: s.answered[other],
    endsAt,
    revealed: s.revealed.map((r) => {
      const rq = s.questions[r.index]!;
      return { index: r.index, textFa: rq.textFa, options: [...rq.options], correctIndex: r.correctIndex, explanationFa: rq.explanationFa, authorFa: rq.authorFa ?? null, yourPick: r.picks[viewer], opponentPick: r.picks[other] };
    }),
  };
}
