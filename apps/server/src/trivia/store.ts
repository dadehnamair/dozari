import { and, asc, count, desc, eq, inArray, puzzleTopics, sql, triviaQuestions, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import type { AgeTrack, TriviaInput, TriviaQuestion } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';

export type TriviaStatus = 'draft' | 'approved' | 'retired';

export interface TriviaRow extends TriviaQuestion {
  ageTrack: AgeTrack;
  status: TriviaStatus;
  createdAt: number;
  /** The player who designed it (workshop), and how often it was answered / answered right (the author's play counter, the measured difficulty). */
  authorId: string | null;
  plays: number;
  rightCount: number;
}

/** I/O boundary of the general four-choice questions (docs/logic/trivia.md). */
export interface TriviaStore {
  create(input: TriviaInput, status?: TriviaStatus, authorId?: string): Promise<{ ok: true; id: string } | { ok: false; error: 'unknown_topic' }>;
  update(id: string, input: TriviaInput): Promise<'ok' | 'not_found' | 'unknown_topic'>;
  setStatus(id: string, status: TriviaStatus): Promise<'ok' | 'not_found'>;
  /** Sets only the difficulty (1–3), e.g. to adopt the measured one. */
  setDifficulty(id: string, difficulty: number): Promise<'ok' | 'not_found'>;
  /** Counts answers a question got in games (humans only): `plays` answers of which `right` were right. */
  recordAnswers(id: string, plays: number, right: number): Promise<void>;
  list(opts: { topicId?: string; status?: TriviaStatus; limit: number }): Promise<TriviaRow[]>;
  /** Approved questions of these tracks, optionally of one topic (the pool a game draws from). */
  approved(opts: { topicId?: string; tracks: readonly AgeTrack[]; limit: number }): Promise<TriviaQuestion[]>;
  /** Topics that have approved questions in these tracks, with the counts, in admin order. */
  topicsWithQuestions(tracks: readonly AgeTrack[]): Promise<{ id: string; nameFa: string; questions: number }[]>;
  /** Every active topic with its approved-question count in these tracks (0 included), in admin order. */
  topicCounts(tracks: readonly AgeTrack[]): Promise<{ id: string; nameFa: string; questions: number }[]>;
  topicName(topicId: string): Promise<string | null>;
}

type Row = typeof triviaQuestions.$inferSelect;
const toRow = (r: Row, authorFa: string | null = null): TriviaRow => ({
  id: r.id,
  topicId: r.topicId,
  textFa: r.textFa,
  options: [r.optionA, r.optionB, r.optionC, r.optionD],
  correctIndex: r.correctIndex,
  explanationFa: r.explanationFa,
  ageTrack: r.ageTrack,
  status: r.status,
  createdAt: r.createdAt.getTime(),
  difficulty: r.difficulty,
  authorId: r.authorId,
  authorFa,
  plays: r.plays,
  rightCount: r.rightCount,
});
const columns = (q: TriviaInput) => ({ topicId: q.topicId, textFa: q.textFa, optionA: q.options[0]!, optionB: q.options[1]!, optionC: q.options[2]!, optionD: q.options[3]!, correctIndex: q.correctIndex, explanationFa: q.explanationFa, ageTrack: q.ageTrack, difficulty: q.difficulty });

export function createDbTriviaStore(db: Db): TriviaStore {
  const topicExists = async (id: string) => (await db.select({ id: puzzleTopics.id }).from(puzzleTopics).where(eq(puzzleTopics.id, id))).length > 0;
  return {
    async create(input, status = 'approved', authorId) {
      if (!(await topicExists(input.topicId))) return { ok: false, error: 'unknown_topic' };
      const id = uuidv7();
      await db.insert(triviaQuestions).values({ id, ...columns(input), status, authorId: authorId ?? null });
      return { ok: true, id };
    },
    async update(id, input) {
      const [r] = await db.select({ id: triviaQuestions.id }).from(triviaQuestions).where(eq(triviaQuestions.id, id));
      if (!r) return 'not_found';
      if (!(await topicExists(input.topicId))) return 'unknown_topic';
      await db.update(triviaQuestions).set(columns(input)).where(eq(triviaQuestions.id, id));
      return 'ok';
    },
    async setStatus(id, status) {
      const [r] = await db.select({ id: triviaQuestions.id }).from(triviaQuestions).where(eq(triviaQuestions.id, id));
      if (!r) return 'not_found';
      await db.update(triviaQuestions).set({ status }).where(eq(triviaQuestions.id, id));
      return 'ok';
    },
    async setDifficulty(id, difficulty) {
      const [r] = await db.select({ id: triviaQuestions.id }).from(triviaQuestions).where(eq(triviaQuestions.id, id));
      if (!r) return 'not_found';
      await db.update(triviaQuestions).set({ difficulty }).where(eq(triviaQuestions.id, id));
      return 'ok';
    },
    async recordAnswers(id, plays, right) {
      if (plays <= 0) return;
      await db.update(triviaQuestions).set({ plays: sql`${triviaQuestions.plays} + ${plays}`, rightCount: sql`${triviaQuestions.rightCount} + ${right}` }).where(eq(triviaQuestions.id, id));
    },
    async list(opts) {
      const where = and(opts.topicId ? eq(triviaQuestions.topicId, opts.topicId) : undefined, opts.status ? eq(triviaQuestions.status, opts.status) : undefined);
      return (await db.select().from(triviaQuestions).where(where).orderBy(desc(triviaQuestions.createdAt)).limit(opts.limit)).map((r) => toRow(r));
    },
    async approved(opts) {
      const where = and(eq(triviaQuestions.status, 'approved'), inArray(triviaQuestions.ageTrack, [...opts.tracks]), opts.topicId ? eq(triviaQuestions.topicId, opts.topicId) : undefined);
      const rows = await db.select({ q: triviaQuestions, author: users.nickname }).from(triviaQuestions).leftJoin(users, eq(users.id, triviaQuestions.authorId)).where(where).orderBy(sql`RAND()`).limit(opts.limit);
      return rows.map((r) => toRow(r.q, r.author));
    },
    async topicCounts(tracks) {
      const rows = await db
        .select({ id: puzzleTopics.id, nameFa: puzzleTopics.nameFa, n: sql<number>`COUNT(${triviaQuestions.id})` })
        .from(puzzleTopics)
        .leftJoin(triviaQuestions, and(eq(triviaQuestions.topicId, puzzleTopics.id), eq(triviaQuestions.status, 'approved'), inArray(triviaQuestions.ageTrack, [...tracks])))
        .where(eq(puzzleTopics.isActive, true))
        .groupBy(puzzleTopics.id, puzzleTopics.nameFa, puzzleTopics.sortOrder)
        .orderBy(asc(puzzleTopics.sortOrder), asc(puzzleTopics.nameFa));
      return rows.map((r) => ({ id: r.id, nameFa: r.nameFa, questions: Number(r.n) }));
    },
    async topicsWithQuestions(tracks) {
      const rows = await db
        .select({ id: puzzleTopics.id, nameFa: puzzleTopics.nameFa, n: count() })
        .from(puzzleTopics)
        .innerJoin(triviaQuestions, and(eq(triviaQuestions.topicId, puzzleTopics.id), eq(triviaQuestions.status, 'approved'), inArray(triviaQuestions.ageTrack, [...tracks])))
        .where(eq(puzzleTopics.isActive, true))
        .groupBy(puzzleTopics.id, puzzleTopics.nameFa, puzzleTopics.sortOrder)
        .orderBy(asc(puzzleTopics.sortOrder), asc(puzzleTopics.nameFa));
      return rows.map((r) => ({ id: r.id, nameFa: r.nameFa, questions: Number(r.n) }));
    },
    async topicName(topicId) {
      const [r] = await db.select({ n: puzzleTopics.nameFa }).from(puzzleTopics).where(eq(puzzleTopics.id, topicId));
      return r?.n ?? null;
    },
  };
}

/** In-memory twin for tests; `topics` are the known topics (id → name). */
export function createMemoryTriviaStore(topics: Record<string, string> = {}): TriviaStore & { rows: TriviaRow[] } {
  const rows: TriviaRow[] = [];
  let seq = 0;
  return {
    rows,
    async create(input, status = 'approved', authorId) {
      if (!(input.topicId in topics)) return { ok: false, error: 'unknown_topic' };
      const id = `00000000-0000-7000-e000-${String(++seq).padStart(12, '0')}`;
      rows.unshift({ id, topicId: input.topicId, textFa: input.textFa, options: [...input.options], correctIndex: input.correctIndex, explanationFa: input.explanationFa, ageTrack: input.ageTrack, difficulty: input.difficulty, authorId: authorId ?? null, authorFa: authorId ? `نویسنده ${authorId.slice(0, 4)}` : null, plays: 0, rightCount: 0, status, createdAt: seq });
      return { ok: true, id };
    },
    async update(id, input) {
      const r = rows.find((x) => x.id === id);
      if (!r) return 'not_found';
      if (!(input.topicId in topics)) return 'unknown_topic';
      Object.assign(r, { topicId: input.topicId, textFa: input.textFa, options: [...input.options], correctIndex: input.correctIndex, explanationFa: input.explanationFa, ageTrack: input.ageTrack, difficulty: input.difficulty });
      return 'ok';
    },
    async setStatus(id, status) {
      const r = rows.find((x) => x.id === id);
      if (!r) return 'not_found';
      r.status = status;
      return 'ok';
    },
    async setDifficulty(id, difficulty) {
      const r = rows.find((x) => x.id === id);
      if (!r) return 'not_found';
      r.difficulty = difficulty;
      return 'ok';
    },
    async recordAnswers(id, plays, right) {
      const r = rows.find((x) => x.id === id);
      if (r) {
        r.plays += plays;
        r.rightCount += right;
      }
    },
    async list(opts) {
      return rows.filter((r) => (!opts.topicId || r.topicId === opts.topicId) && (!opts.status || r.status === opts.status)).slice(0, opts.limit);
    },
    async approved(opts) {
      return rows.filter((r) => r.status === 'approved' && opts.tracks.includes(r.ageTrack) && (!opts.topicId || r.topicId === opts.topicId)).slice(0, opts.limit);
    },
    async topicsWithQuestions(tracks) {
      return Object.entries(topics)
        .map(([id, nameFa]) => ({ id, nameFa, questions: rows.filter((r) => r.topicId === id && r.status === 'approved' && tracks.includes(r.ageTrack)).length }))
        .filter((t) => t.questions > 0);
    },
    async topicCounts(tracks) {
      return Object.entries(topics).map(([id, nameFa]) => ({ id, nameFa, questions: rows.filter((r) => r.topicId === id && r.status === 'approved' && tracks.includes(r.ageTrack)).length }));
    },
    async topicName(topicId) {
      return topics[topicId] ?? null;
    },
  };
}
