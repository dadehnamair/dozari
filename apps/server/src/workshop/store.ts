import { and, asc, desc, eq, gte, ne, puzzleTopics, sql, triviaQuestions, triviaReviews, triviaSubmissions, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import type { WorkshopRejectReason, WorkshopStatus } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';

export interface SubmissionRow {
  id: string;
  userId: string;
  topicId: string;
  textFa: string;
  options: string[];
  correctIndex: number;
  explanationFa: string;
  difficulty: number;
  status: WorkshopStatus;
  score: number;
  reviews: number;
  disputes: number;
  rejectReason: WorkshopRejectReason | null;
  questionId: string | null;
  rewardCoins: number;
  createdAt: number;
  decidedAt: number | null;
}
export type NewSubmission = Pick<SubmissionRow, 'userId' | 'topicId' | 'textFa' | 'options' | 'correctIndex' | 'explanationFa' | 'difficulty'>;
export type AdminSubmission = SubmissionRow & { userName: string; topicNameFa: string };
export type MineRow = SubmissionRow & { topicNameFa: string; plays: number };

export interface ReviewRow {
  submissionId: string;
  reviewerId: string;
  answerIndex: number;
  quality: 1 | -1;
  points: number;
  settledAt: number | null;
  at: number;
}

/** A reviewer's points before and after a settlement (to pay the coin milestones they crossed). */
export interface SettledReviewer {
  reviewerId: string;
  before: number;
  after: number;
}

/** I/O boundary of the question workshop (docs/logic/question-workshop.md). */
export interface WorkshopStore {
  add(s: NewSubmission): Promise<SubmissionRow>;
  get(id: string): Promise<SubmissionRow | null>;
  submissionsSince(userId: string, sinceMs: number): Promise<number>;
  /** Texts of the open (pending / ready) submissions of a topic, for the duplicate check. */
  openTexts(topicId: string): Promise<string[]>;
  /** The submission with the fewest reviews among those a player may still review (not theirs, not yet reviewed by them, still pending). */
  nextToReview(userId: string): Promise<SubmissionRow | null>;
  waitingFor(userId: string): Promise<number>;
  reviewsSince(userId: string, sinceMs: number): Promise<number>;
  /** Stores a review and updates the submission's score, review count and disputes in one step. */
  addReview(submissionId: string, reviewerId: string, review: { answerIndex: number; quality: 1 | -1; matches: boolean; points: number; score: number }): Promise<{ score: number; reviews: number; disputes: number } | 'duplicate' | 'closed' | 'not_found'>;
  /** Moves a still-open submission (pending / ready) to a new status; false when it was already decided. */
  decide(id: string, status: 'ready_for_review' | 'approved' | 'rejected', now: number, rejectReason?: WorkshopRejectReason): Promise<boolean>;
  /** Moves a pending submission to the admin queue or rejects it automatically (never touches a decided one). */
  autoState(id: string, status: 'ready_for_review' | 'rejected', now: number, rejectReason?: WorkshopRejectReason): Promise<boolean>;
  attachQuestion(id: string, questionId: string, coins: number): Promise<void>;
  /** Points a reviewer has in total. */
  points(userId: string): Promise<number>;
  approvedCount(userId: string): Promise<number>;
  counts(userId: string): Promise<{ approved: number; pending: number; rejected: number }>;
  mine(userId: string, limit: number): Promise<MineRow[]>;
  list(status: WorkshopStatus | null, limit: number): Promise<AdminSubmission[]>;
  /** Settles every unsettled review of a decided submission: the agreement bonus where it applies. Returns each affected reviewer's points. */
  settle(id: string, finalCorrectIndex: number, outcome: 'approved' | 'rejected', bonus: number, now: number): Promise<SettledReviewer[]>;
  topAuthors(sinceMs: number | null, limit: number): Promise<{ userId: string; nickname: string; approved: number }[]>;
  topReviewers(sinceMs: number | null, limit: number): Promise<{ userId: string; nickname: string; points: number }[]>;
}

type SubRow = typeof triviaSubmissions.$inferSelect;
const toSub = (r: SubRow): SubmissionRow => ({
  id: r.id,
  userId: r.userId,
  topicId: r.topicId,
  textFa: r.textFa,
  options: [r.optionA, r.optionB, r.optionC, r.optionD],
  correctIndex: r.correctIndex,
  explanationFa: r.explanationFa,
  difficulty: r.difficulty,
  status: r.status,
  score: r.score,
  reviews: r.reviews,
  disputes: r.disputes,
  rejectReason: r.rejectReason,
  questionId: r.questionId,
  rewardCoins: r.rewardCoins,
  createdAt: r.createdAt.getTime(),
  decidedAt: r.decidedAt ? r.decidedAt.getTime() : null,
});

const OPEN = sql`${triviaSubmissions.status} IN ('pending','ready_for_review')`;

export function createDbWorkshopStore(db: Db): WorkshopStore {
  const topicNames = async (): Promise<Map<string, string>> => new Map((await db.select({ id: puzzleTopics.id, n: puzzleTopics.nameFa }).from(puzzleTopics)).map((t) => [t.id, t.n] as const));
  return {
    async add(s) {
      const id = uuidv7();
      await db.insert(triviaSubmissions).values({ id, userId: s.userId, topicId: s.topicId, textFa: s.textFa, optionA: s.options[0]!, optionB: s.options[1]!, optionC: s.options[2]!, optionD: s.options[3]!, correctIndex: s.correctIndex, explanationFa: s.explanationFa, difficulty: s.difficulty });
      const [r] = await db.select().from(triviaSubmissions).where(eq(triviaSubmissions.id, id));
      return toSub(r!);
    },
    async get(id) {
      const [r] = await db.select().from(triviaSubmissions).where(eq(triviaSubmissions.id, id));
      return r ? toSub(r) : null;
    },
    async submissionsSince(userId, sinceMs) {
      const [r] = await db.select({ n: sql<number>`COUNT(*)` }).from(triviaSubmissions).where(and(eq(triviaSubmissions.userId, userId), gte(triviaSubmissions.createdAt, new Date(sinceMs))));
      return Number(r?.n ?? 0);
    },
    async openTexts(topicId) {
      return (await db.select({ t: triviaSubmissions.textFa }).from(triviaSubmissions).where(and(eq(triviaSubmissions.topicId, topicId), OPEN)).limit(1000)).map((r) => r.t);
    },
    async nextToReview(userId) {
      const [r] = await db
        .select()
        .from(triviaSubmissions)
        .where(and(eq(triviaSubmissions.status, 'pending'), ne(triviaSubmissions.userId, userId), sql`NOT EXISTS (SELECT 1 FROM ${triviaReviews} WHERE ${triviaReviews.submissionId} = ${triviaSubmissions.id} AND ${triviaReviews.reviewerId} = ${userId})`))
        .orderBy(asc(triviaSubmissions.reviews), asc(triviaSubmissions.createdAt))
        .limit(1);
      return r ? toSub(r) : null;
    },
    async waitingFor(userId) {
      const [r] = await db
        .select({ n: sql<number>`COUNT(*)` })
        .from(triviaSubmissions)
        .where(and(eq(triviaSubmissions.status, 'pending'), ne(triviaSubmissions.userId, userId), sql`NOT EXISTS (SELECT 1 FROM ${triviaReviews} WHERE ${triviaReviews.submissionId} = ${triviaSubmissions.id} AND ${triviaReviews.reviewerId} = ${userId})`));
      return Number(r?.n ?? 0);
    },
    async reviewsSince(userId, sinceMs) {
      const [r] = await db.select({ n: sql<number>`COUNT(*)` }).from(triviaReviews).where(and(eq(triviaReviews.reviewerId, userId), gte(triviaReviews.createdAt, new Date(sinceMs))));
      return Number(r?.n ?? 0);
    },
    async addReview(submissionId, reviewerId, review) {
      return db.transaction(async (tx) => {
        const [s] = await tx.select().from(triviaSubmissions).where(eq(triviaSubmissions.id, submissionId)).for('update');
        if (!s) return 'not_found' as const;
        if (s.status !== 'pending') return 'closed' as const;
        const [dup] = await tx.select({ n: sql<number>`COUNT(*)` }).from(triviaReviews).where(and(eq(triviaReviews.submissionId, submissionId), eq(triviaReviews.reviewerId, reviewerId)));
        if (Number(dup?.n ?? 0) > 0) return 'duplicate' as const;
        await tx.insert(triviaReviews).values({ submissionId, reviewerId, answerIndex: review.answerIndex, quality: review.quality, points: review.points });
        const next = { score: s.score + review.score, reviews: s.reviews + 1, disputes: s.disputes + (review.matches ? 0 : 1) };
        await tx.update(triviaSubmissions).set(next).where(eq(triviaSubmissions.id, submissionId));
        return next;
      });
    },
    async decide(id, status, now, rejectReason) {
      const res = await db.update(triviaSubmissions).set({ status, decidedAt: new Date(now), ...(rejectReason ? { rejectReason } : {}) }).where(and(eq(triviaSubmissions.id, id), OPEN));
      return affected(res) > 0;
    },
    async autoState(id, status, now, rejectReason) {
      const res = await db.update(triviaSubmissions).set({ status, ...(status === 'rejected' ? { decidedAt: new Date(now), ...(rejectReason ? { rejectReason } : {}) } : {}) }).where(and(eq(triviaSubmissions.id, id), eq(triviaSubmissions.status, 'pending')));
      return affected(res) > 0;
    },
    async attachQuestion(id, questionId, coins) {
      await db.update(triviaSubmissions).set({ questionId, rewardCoins: coins, rewardedAt: new Date() }).where(eq(triviaSubmissions.id, id));
    },
    async points(userId) {
      const [r] = await db.select({ p: sql<number>`COALESCE(SUM(${triviaReviews.points}), 0)` }).from(triviaReviews).where(eq(triviaReviews.reviewerId, userId));
      return Number(r?.p ?? 0);
    },
    async approvedCount(userId) {
      const [r] = await db.select({ n: sql<number>`COUNT(*)` }).from(triviaSubmissions).where(and(eq(triviaSubmissions.userId, userId), eq(triviaSubmissions.status, 'approved')));
      return Number(r?.n ?? 0);
    },
    async counts(userId) {
      const rows = await db.select({ s: triviaSubmissions.status, n: sql<number>`COUNT(*)` }).from(triviaSubmissions).where(eq(triviaSubmissions.userId, userId)).groupBy(triviaSubmissions.status);
      const by = (s: string) => Number(rows.find((r) => r.s === s)?.n ?? 0);
      return { approved: by('approved'), pending: by('pending') + by('ready_for_review'), rejected: by('rejected') };
    },
    async mine(userId, limit) {
      const names = await topicNames();
      const rows = await db
        .select({ s: triviaSubmissions, plays: triviaQuestions.plays })
        .from(triviaSubmissions)
        .leftJoin(triviaQuestions, eq(triviaQuestions.id, triviaSubmissions.questionId))
        .where(eq(triviaSubmissions.userId, userId))
        .orderBy(desc(triviaSubmissions.createdAt))
        .limit(limit);
      return rows.map((r) => ({ ...toSub(r.s), topicNameFa: names.get(r.s.topicId) ?? '', plays: r.plays ?? 0 }));
    },
    async list(status, limit) {
      const names = await topicNames();
      const rows = await db
        .select({ s: triviaSubmissions, name: users.nickname })
        .from(triviaSubmissions)
        .innerJoin(users, eq(users.id, triviaSubmissions.userId))
        .where(status ? eq(triviaSubmissions.status, status) : undefined)
        .orderBy(desc(triviaSubmissions.score), asc(triviaSubmissions.createdAt))
        .limit(limit);
      return rows.map((r) => ({ ...toSub(r.s), userName: r.name, topicNameFa: names.get(r.s.topicId) ?? '' }));
    },
    async settle(id, finalCorrectIndex, outcome, bonus, now) {
      return db.transaction(async (tx) => {
        const rows = await tx.select().from(triviaReviews).where(eq(triviaReviews.submissionId, id));
        const pending = rows.filter((r) => r.settledAt === null);
        const out = new Map<string, SettledReviewer>();
        for (const r of pending) {
          const agreed = r.answerIndex === finalCorrectIndex && r.quality === (outcome === 'approved' ? 1 : -1);
          const [t] = await tx.select({ p: sql<number>`COALESCE(SUM(${triviaReviews.points}), 0)` }).from(triviaReviews).where(eq(triviaReviews.reviewerId, r.reviewerId));
          const before = out.get(r.reviewerId)?.after ?? Number(t?.p ?? 0);
          const gain = agreed ? Math.max(0, bonus) : 0;
          await tx.update(triviaReviews).set({ points: r.points + gain, settledAt: new Date(now) }).where(and(eq(triviaReviews.submissionId, id), eq(triviaReviews.reviewerId, r.reviewerId)));
          out.set(r.reviewerId, { reviewerId: r.reviewerId, before: out.get(r.reviewerId)?.before ?? before, after: before + gain });
        }
        return [...out.values()];
      });
    },
    async topAuthors(sinceMs, limit) {
      const rows = await db
        .select({ userId: triviaSubmissions.userId, nickname: users.nickname, n: sql<number>`COUNT(*)` })
        .from(triviaSubmissions)
        .innerJoin(users, eq(users.id, triviaSubmissions.userId))
        .where(and(eq(triviaSubmissions.status, 'approved'), sinceMs === null ? undefined : gte(triviaSubmissions.decidedAt, new Date(sinceMs))))
        .groupBy(triviaSubmissions.userId, users.nickname)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(limit);
      return rows.map((r) => ({ userId: r.userId, nickname: r.nickname, approved: Number(r.n) }));
    },
    async topReviewers(sinceMs, limit) {
      const rows = await db
        .select({ userId: triviaReviews.reviewerId, nickname: users.nickname, p: sql<number>`SUM(${triviaReviews.points})` })
        .from(triviaReviews)
        .innerJoin(users, eq(users.id, triviaReviews.reviewerId))
        .where(sinceMs === null ? undefined : gte(triviaReviews.createdAt, new Date(sinceMs)))
        .groupBy(triviaReviews.reviewerId, users.nickname)
        .orderBy(desc(sql`SUM(${triviaReviews.points})`))
        .limit(limit);
      return rows.map((r) => ({ userId: r.userId, nickname: r.nickname, points: Number(r.p) }));
    },
  };
}

/** mysql2 reports the number of changed rows in the first element of the result header. */
function affected(res: unknown): number {
  const header = Array.isArray(res) ? (res[0] as { affectedRows?: number } | undefined) : (res as { affectedRows?: number } | undefined);
  return header?.affectedRows ?? 0;
}

/** In-memory twin for tests. */
export function createMemoryWorkshopStore(topics: Record<string, string> = {}, nicknames: Record<string, string> = {}): WorkshopStore & { subs: SubmissionRow[]; reviewRows: ReviewRow[]; plays: Map<string, number>; clock: { ms: number } } {
  const subs: SubmissionRow[] = [];
  const reviewRows: ReviewRow[] = [];
  const plays = new Map<string, number>();
  const clock = { ms: 1_000_000 };
  let seq = 0;
  const nick = (id: string) => nicknames[id] ?? id;
  const sub = (id: string) => subs.find((s) => s.id === id);
  const open = (s: SubmissionRow) => s.status === 'pending' || s.status === 'ready_for_review';
  const reviewedBy = (id: string, u: string) => reviewRows.some((r) => r.submissionId === id && r.reviewerId === u);
  const pointsOf = (u: string) => reviewRows.filter((r) => r.reviewerId === u).reduce((a, r) => a + r.points, 0);
  return {
    subs,
    reviewRows,
    plays,
    clock,
    async add(s) {
      const row: SubmissionRow = { id: `00000000-0000-7000-f000-${String(++seq).padStart(12, '0')}`, ...s, options: [...s.options], status: 'pending', score: 0, reviews: 0, disputes: 0, rejectReason: null, questionId: null, rewardCoins: 0, createdAt: clock.ms++, decidedAt: null };
      subs.push(row);
      return { ...row };
    },
    async get(id) {
      const s = sub(id);
      return s ? { ...s } : null;
    },
    async submissionsSince(u, since) {
      return subs.filter((s) => s.userId === u && s.createdAt >= since).length;
    },
    async openTexts(topicId) {
      return subs.filter((s) => s.topicId === topicId && open(s)).map((s) => s.textFa);
    },
    async nextToReview(u) {
      const c = subs.filter((s) => s.status === 'pending' && s.userId !== u && !reviewedBy(s.id, u)).sort((a, b) => a.reviews - b.reviews || a.createdAt - b.createdAt);
      return c[0] ? { ...c[0] } : null;
    },
    async waitingFor(u) {
      return subs.filter((s) => s.status === 'pending' && s.userId !== u && !reviewedBy(s.id, u)).length;
    },
    async reviewsSince(u, since) {
      return reviewRows.filter((r) => r.reviewerId === u && r.at >= since).length;
    },
    async addReview(id, u, r) {
      const s = sub(id);
      if (!s) return 'not_found';
      if (s.status !== 'pending') return 'closed';
      if (reviewedBy(id, u)) return 'duplicate';
      reviewRows.push({ submissionId: id, reviewerId: u, answerIndex: r.answerIndex, quality: r.quality, points: r.points, settledAt: null, at: clock.ms });
      s.score += r.score;
      s.reviews += 1;
      s.disputes += r.matches ? 0 : 1;
      return { score: s.score, reviews: s.reviews, disputes: s.disputes };
    },
    async decide(id, status, now, reason) {
      const s = sub(id);
      if (!s || !open(s)) return false;
      s.status = status;
      s.decidedAt = now;
      if (reason) s.rejectReason = reason;
      return true;
    },
    async autoState(id, status, now, reason) {
      const s = sub(id);
      if (!s || s.status !== 'pending') return false;
      s.status = status;
      if (status === 'rejected') {
        s.decidedAt = now;
        if (reason) s.rejectReason = reason;
      }
      return true;
    },
    async attachQuestion(id, questionId, coins) {
      const s = sub(id);
      if (s) Object.assign(s, { questionId, rewardCoins: coins });
    },
    async points(u) {
      return pointsOf(u);
    },
    async approvedCount(u) {
      return subs.filter((s) => s.userId === u && s.status === 'approved').length;
    },
    async counts(u) {
      const mine = subs.filter((s) => s.userId === u);
      return { approved: mine.filter((s) => s.status === 'approved').length, pending: mine.filter(open).length, rejected: mine.filter((s) => s.status === 'rejected').length };
    },
    async mine(u, limit) {
      return subs.filter((s) => s.userId === u).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit).map((s) => ({ ...s, topicNameFa: topics[s.topicId] ?? '', plays: s.questionId ? (plays.get(s.questionId) ?? 0) : 0 }));
    },
    async list(status, limit) {
      return subs.filter((s) => !status || s.status === status).sort((a, b) => b.score - a.score || a.createdAt - b.createdAt).slice(0, limit).map((s) => ({ ...s, userName: nick(s.userId), topicNameFa: topics[s.topicId] ?? '' }));
    },
    async settle(id, finalCorrect, outcome, bonus, now) {
      const out = new Map<string, SettledReviewer>();
      for (const r of reviewRows.filter((x) => x.submissionId === id && x.settledAt === null)) {
        const agreed = r.answerIndex === finalCorrect && r.quality === (outcome === 'approved' ? 1 : -1);
        const before = out.get(r.reviewerId)?.after ?? pointsOf(r.reviewerId);
        const gain = agreed ? Math.max(0, bonus) : 0;
        r.points += gain;
        r.settledAt = now;
        out.set(r.reviewerId, { reviewerId: r.reviewerId, before: out.get(r.reviewerId)?.before ?? before, after: before + gain });
      }
      return [...out.values()];
    },
    async topAuthors(_since, limit) {
      const by = new Map<string, number>();
      for (const s of subs.filter((x) => x.status === 'approved')) by.set(s.userId, (by.get(s.userId) ?? 0) + 1);
      return [...by].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([userId, approved]) => ({ userId, nickname: nick(userId), approved }));
    },
    async topReviewers(_since, limit) {
      const by = new Map<string, number>();
      for (const r of reviewRows) by.set(r.reviewerId, (by.get(r.reviewerId) ?? 0) + r.points);
      return [...by].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([userId, points]) => ({ userId, nickname: nick(userId), points }));
    },
  };
}
