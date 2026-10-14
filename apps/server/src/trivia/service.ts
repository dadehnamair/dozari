import { randomInt } from 'node:crypto';
import { TRIVIA_QUESTIONS_PER_GAME, TRIVIA_SOLO_REFUND_PERCENT, mulberry32, pickTriviaQuestions, shuffleTrivia, triviaSoloPassed } from '@dozari/shared';
import type { AgeTrack, TriviaResult, TriviaView } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';
import type { TriviaStore } from './store.js';
import type { TriviaStakes } from './stakes.js';

interface Session {
  userId?: string;
  topicNameFa: string | null;
  questions: { textFa: string; options: string[]; correctIndex: number; explanationFa: string; topicNameFa: string }[];
  results: TriviaResult[];
  touchedAt: number;
  /** Coins the game cost this player, and what came back (once, at the end). */
  fee: number;
  refund: number;
}

export interface TriviaOptions {
  now?: () => number;
  newSeed?: () => number;
  ttlMs?: number;
  /** Questions per game (admin setting); absent = the shared default. */
  perGame?: () => Promise<number>;
  /** Called once when a signed-in player answers the last question; `passed` = the score earned the fee back (counts as a win for XP). */
  onFinished?: (userId: string, score: number, total: number, passed: boolean) => void;
  /** Coins of a solo game (docs/logic/trivia.md §Coins). Absent = free. */
  stakes?: Pick<TriviaStakes, 'soloFee' | 'chargeSolo' | 'refundSolo'>;
  /** Percent of right answers that earns the fee back (setting `trivia.solo_refund_percent`). */
  refundPercent?: () => Promise<number>;
}

const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * General four-choice games (docs/logic/trivia.md): in memory like price-only. The choices are shuffled when the game starts and the right
 * one leaves the server only in the answer to that question.
 */
export class TriviaService {
  private readonly sessions = new Map<string, Session>();
  private readonly now: () => number;
  private readonly newSeed: () => number;
  private readonly ttlMs: number;

  constructor(
    private readonly store: TriviaStore,
    private readonly opts: TriviaOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.newSeed = opts.newSeed ?? (() => randomInt(0, 2 ** 31));
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  }

  topics(tracks: readonly AgeTrack[]) {
    return this.store.topicsWithQuestions(tracks);
  }

  /** Starts a game on one topic (or a mix when `topicId` is absent); null when there is nothing to ask. */
  async start(opts: { userId?: string; topicId?: string; tracks: readonly AgeTrack[] }): Promise<TriviaView | null | 'insufficient_coins'> {
    this.sweep();
    const want = Math.max(1, (await this.opts.perGame?.().catch(() => undefined)) ?? TRIVIA_QUESTIONS_PER_GAME);
    const rng = mulberry32(this.newSeed());
    const pool = await this.store.approved({ topicId: opts.topicId, tracks: opts.tracks, limit: Math.max(60, want * 6) });
    const picked = pickTriviaQuestions(pool, want, rng);
    if (picked.length === 0) return null;
    const names = new Map<string, string>();
    for (const q of picked) if (!names.has(q.topicId)) names.set(q.topicId, (await this.store.topicName(q.topicId)) ?? '');
    const id = uuidv7();
    // A signed-in player pays the fee once there is something to ask; an anonymous game is free.
    const fee = opts.userId && this.opts.stakes ? ((await this.opts.stakes.soloFee().catch(() => 0)) ?? 0) : 0;
    if (fee > 0 && !(await this.opts.stakes!.chargeSolo(id, opts.userId!))) return 'insufficient_coins';
    const session: Session = {
      fee,
      refund: 0,
      userId: opts.userId,
      topicNameFa: opts.topicId ? (names.get(opts.topicId) ?? (await this.store.topicName(opts.topicId))) : null,
      questions: picked.map((q) => ({ textFa: q.textFa, explanationFa: q.explanationFa, topicNameFa: names.get(q.topicId) ?? '', ...shuffleTrivia(q, rng) })),
      results: [],
      touchedAt: this.now(),
    };
    this.sessions.set(id, session);
    return this.toView(id, session);
  }

  view(sessionId: string): TriviaView | null {
    const s = this.live(sessionId);
    return s ? this.toView(sessionId, s) : null;
  }

  /** Answers question `index`. A second answer to the same question returns the first one unchanged. */
  async answer(sessionId: string, index: number, pickedIndex: number): Promise<{ result: TriviaResult; view: TriviaView } | null | 'unknown_question'> {
    const s = this.live(sessionId);
    if (!s) return null;
    const q = s.questions[index];
    if (!q) return 'unknown_question';
    let result = s.results.find((r) => r.index === index);
    if (!result) {
      result = { index, pickedIndex, correctIndex: q.correctIndex, correct: pickedIndex === q.correctIndex, explanationFa: q.explanationFa || null };
      s.results.push(result);
      if (s.results.length === s.questions.length && s.userId) {
        const score = s.results.filter((r) => r.correct).length;
        const percent = await (this.opts.refundPercent?.() ?? Promise.resolve(TRIVIA_SOLO_REFUND_PERCENT)).catch(() => TRIVIA_SOLO_REFUND_PERCENT);
        const passed = triviaSoloPassed(score, s.questions.length, percent);
        try {
          // A good score gives the fee back (idempotent per game).
          if (passed && s.fee > 0) s.refund = (await this.opts.stakes?.refundSolo(sessionId, s.userId, s.fee).catch(() => 0)) ?? 0;
          this.opts.onFinished?.(s.userId, score, s.questions.length, passed);
        } catch {
          /* recording a game must not break answering */
        }
      }
    }
    return { result, view: this.toView(sessionId, s) };
  }

  private toView(sessionId: string, s: Session): TriviaView {
    return {
      sessionId,
      topicNameFa: s.topicNameFa,
      rounds: s.questions.map((q, index) => ({ index, textFa: q.textFa, options: q.options, topicNameFa: q.topicNameFa })),
      results: [...s.results].sort((a, b) => a.index - b.index),
      done: s.results.length === s.questions.length,
      score: s.results.filter((r) => r.correct).length,
      fee: s.fee,
      refund: s.refund,
    };
  }

  private live(sessionId: string): Session | null {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    if (this.now() - s.touchedAt > this.ttlMs) {
      this.sessions.delete(sessionId);
      return null;
    }
    s.touchedAt = this.now();
    return s;
  }

  private sweep(): void {
    const cutoff = this.now() - this.ttlMs;
    for (const [id, s] of this.sessions) if (s.touchedAt < cutoff) this.sessions.delete(id);
  }
}
