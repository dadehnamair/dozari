import { and, desc, eq, gte, ne, notExists, products, sql, ugcSubmissions, ugcVotes, userReports, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';
import type { ReportCategory, SubmissionKind, SubmissionStatus } from '@dozari/shared';

export interface ReportRow {
  id: string;
  reporterId: string;
  targetId: string;
  category: ReportCategory;
  details: string;
  createdAt: number;
  resolved: boolean;
}
export type AdminReport = ReportRow & { reporterName: string; targetName: string };

export interface SubmissionRow {
  id: string;
  userId: string;
  kind: SubmissionKind;
  status: SubmissionStatus;
  productId: string | null;
  nameFa: string;
  category: string | null;
  unitFa: string | null;
  year: number | null;
  priceRials: number | null;
  sourceType: 'website' | 'user_memory' | 'other';
  sourceText: string;
  note: string;
  score: number;
  rewarded: boolean;
  createdAt: number;
  decidedAt: number | null;
}
export type NewSubmission = Omit<SubmissionRow, 'id' | 'status' | 'score' | 'rewarded' | 'createdAt' | 'decidedAt'>;
export type AdminSubmission = SubmissionRow & { userName: string };

/** I/O boundary of reports and suggestions. */
export interface FeedbackStore {
  addReport(r: Pick<ReportRow, 'reporterId' | 'targetId' | 'category' | 'details'>): Promise<ReportRow>;
  reportsSince(reporterId: string, sinceMs: number): Promise<number>;
  hasOpenReport(reporterId: string, targetId: string): Promise<boolean>;
  reports(limit: number): Promise<AdminReport[]>;
  resolveReport(id: string): Promise<boolean>;

  addSubmission(s: NewSubmission): Promise<SubmissionRow>;
  submissionsSince(userId: string, sinceMs: number): Promise<number>;
  submission(id: string): Promise<SubmissionRow | null>;
  /** The oldest pending suggestion of someone else that this player has not voted on. */
  nextToVote(userId: string): Promise<SubmissionRow | null>;
  /** One vote per player; returns the new score, or 'voted' / 'not_found'. */
  vote(id: string, userId: string, value: 1 | -1): Promise<{ score: number } | 'voted' | 'not_found'>;
  /** Moves a submission that is still undecided (pending or ready_for_review) to `status`. */
  setStatus(id: string, status: SubmissionStatus, now: number): Promise<boolean>;
  /** True for the single caller that gets to pay the reward. */
  claimReward(id: string, now: number): Promise<boolean>;
  list(status: SubmissionStatus | null, limit: number): Promise<AdminSubmission[]>;
}

const toReport = (r: typeof userReports.$inferSelect): ReportRow => ({ id: r.id, reporterId: r.reporterId, targetId: r.targetId, category: r.category, details: r.details, createdAt: r.createdAt.getTime(), resolved: r.resolvedAt !== null });
const toSubmission = (r: typeof ugcSubmissions.$inferSelect): SubmissionRow => ({
  id: r.id, userId: r.userId, kind: r.kind, status: r.status, productId: r.productId, nameFa: r.nameFa, category: r.category, unitFa: r.unitFa, year: r.year,
  priceRials: r.priceRials, sourceType: r.sourceType, sourceText: r.sourceText, note: r.note, score: r.score, rewarded: r.rewardedAt !== null, createdAt: r.createdAt.getTime(), decidedAt: r.decidedAt ? r.decidedAt.getTime() : null,
});

/** The catalog's product ids and names (for «this item already exists» and card titles). */
export function createDbCatalogLookup(db: Db): () => Promise<{ id: string; nameFa: string }[]> {
  return async () => db.select({ id: products.id, nameFa: products.nameFa }).from(products);
}

export function createDbFeedbackStore(db: Db): FeedbackStore {
  return {
    async addReport(r) {
      const row = { id: uuidv7(), ...r };
      await db.insert(userReports).values(row);
      return { ...row, createdAt: Date.now(), resolved: false };
    },
    async reportsSince(reporterId, sinceMs) {
      const [r] = await db.select({ n: sql<number>`COUNT(*)` }).from(userReports).where(and(eq(userReports.reporterId, reporterId), gte(userReports.createdAt, new Date(sinceMs))));
      return Number(r?.n ?? 0);
    },
    async hasOpenReport(reporterId, targetId) {
      const [r] = await db.select({ id: userReports.id }).from(userReports).where(and(eq(userReports.reporterId, reporterId), eq(userReports.targetId, targetId), sql`${userReports.resolvedAt} IS NULL`)).limit(1);
      return !!r;
    },
    async reports(limit) {
      const rows = await db.select().from(userReports).orderBy(desc(userReports.createdAt)).limit(limit);
      const ids = [...new Set(rows.flatMap((r) => [r.reporterId, r.targetId]))];
      const names = ids.length ? new Map((await db.select({ id: users.id, n: users.nickname }).from(users)).filter((u) => ids.includes(u.id)).map((u) => [u.id, u.n])) : new Map<string, string>();
      return rows.map((r) => ({ ...toReport(r), reporterName: names.get(r.reporterId) ?? '—', targetName: names.get(r.targetId) ?? '—' }));
    },
    async resolveReport(id) {
      const [res] = await db.update(userReports).set({ resolvedAt: new Date() }).where(and(eq(userReports.id, id), sql`${userReports.resolvedAt} IS NULL`));
      return res.affectedRows > 0;
    },

    async addSubmission(s) {
      const id = uuidv7();
      await db.insert(ugcSubmissions).values({ id, ...s });
      const [r] = await db.select().from(ugcSubmissions).where(eq(ugcSubmissions.id, id));
      return toSubmission(r!);
    },
    async submissionsSince(userId, sinceMs) {
      const [r] = await db.select({ n: sql<number>`COUNT(*)` }).from(ugcSubmissions).where(and(eq(ugcSubmissions.userId, userId), gte(ugcSubmissions.createdAt, new Date(sinceMs))));
      return Number(r?.n ?? 0);
    },
    async submission(id) {
      const [r] = await db.select().from(ugcSubmissions).where(eq(ugcSubmissions.id, id));
      return r ? toSubmission(r) : null;
    },
    async nextToVote(userId) {
      const [r] = await db
        .select()
        .from(ugcSubmissions)
        .where(and(eq(ugcSubmissions.status, 'pending'), ne(ugcSubmissions.userId, userId), notExists(db.select({ x: sql`1` }).from(ugcVotes).where(and(eq(ugcVotes.submissionId, ugcSubmissions.id), eq(ugcVotes.userId, userId))))))
        .orderBy(ugcSubmissions.createdAt)
        .limit(1);
      return r ? toSubmission(r) : null;
    },
    vote: (id, userId, value) =>
      db.transaction(async (tx) => {
        const [s] = await tx.select({ score: ugcSubmissions.score }).from(ugcSubmissions).where(eq(ugcSubmissions.id, id));
        if (!s) return 'not_found' as const;
        const [res] = await tx.insert(ugcVotes).ignore().values({ submissionId: id, userId, value });
        if (res.affectedRows < 1) return 'voted' as const;
        await tx.update(ugcSubmissions).set({ score: sql`${ugcSubmissions.score} + ${value}` }).where(eq(ugcSubmissions.id, id));
        return { score: s.score + value };
      }),
    async setStatus(id, status, now) {
      const [res] = await db
        .update(ugcSubmissions)
        .set({ status, decidedAt: status === 'pending' || status === 'ready_for_review' ? null : new Date(now) })
        .where(and(eq(ugcSubmissions.id, id), sql`${ugcSubmissions.status} IN ('pending','ready_for_review')`));
      return res.affectedRows > 0;
    },
    async claimReward(id, now) {
      const [res] = await db.update(ugcSubmissions).set({ rewardedAt: new Date(now) }).where(and(eq(ugcSubmissions.id, id), sql`${ugcSubmissions.rewardedAt} IS NULL`));
      return res.affectedRows > 0;
    },
    async list(status, limit) {
      const rows = await db.select().from(ugcSubmissions).where(status ? eq(ugcSubmissions.status, status) : undefined).orderBy(desc(ugcSubmissions.createdAt)).limit(limit);
      const names = new Map((await db.select({ id: users.id, n: users.nickname }).from(users)).map((u) => [u.id, u.n]));
      return rows.map((r) => ({ ...toSubmission(r), userName: names.get(r.userId) ?? '—' }));
    },
  };
}

/** In-memory twin for tests. */
export function createMemoryFeedbackStore(now: () => number = Date.now): FeedbackStore {
  const reports: ReportRow[] = [];
  const subs: SubmissionRow[] = [];
  const votes = new Map<string, number>();
  let n = 0;
  const id = () => `00000000-0000-7000-8000-${String(++n).padStart(12, '0')}`;
  return {
    async addReport(r) {
      const row: ReportRow = { id: id(), ...r, createdAt: now(), resolved: false };
      reports.push(row);
      return { ...row };
    },
    async reportsSince(reporterId, sinceMs) {
      return reports.filter((r) => r.reporterId === reporterId && r.createdAt >= sinceMs).length;
    },
    async hasOpenReport(reporterId, targetId) {
      return reports.some((r) => r.reporterId === reporterId && r.targetId === targetId && !r.resolved);
    },
    async reports(limit) {
      return [...reports].reverse().slice(0, limit).map((r) => ({ ...r, reporterName: r.reporterId, targetName: r.targetId }));
    },
    async resolveReport(rid) {
      const r = reports.find((x) => x.id === rid && !x.resolved);
      if (!r) return false;
      r.resolved = true;
      return true;
    },
    async addSubmission(s) {
      const row: SubmissionRow = { id: id(), ...s, status: 'pending', score: 0, rewarded: false, createdAt: now(), decidedAt: null };
      subs.push(row);
      return { ...row };
    },
    async submissionsSince(userId, sinceMs) {
      return subs.filter((s) => s.userId === userId && s.createdAt >= sinceMs).length;
    },
    async submission(sid) {
      const s = subs.find((x) => x.id === sid);
      return s ? { ...s } : null;
    },
    async nextToVote(userId) {
      const s = subs.find((x) => x.status === 'pending' && x.userId !== userId && !votes.has(`${x.id}:${userId}`));
      return s ? { ...s } : null;
    },
    async vote(sid, userId, value) {
      const s = subs.find((x) => x.id === sid);
      if (!s) return 'not_found';
      if (votes.has(`${sid}:${userId}`)) return 'voted';
      votes.set(`${sid}:${userId}`, value);
      s.score += value;
      return { score: s.score };
    },
    async setStatus(sid, status, at) {
      const s = subs.find((x) => x.id === sid);
      if (!s || (s.status !== 'pending' && s.status !== 'ready_for_review')) return false;
      s.status = status;
      s.decidedAt = status === 'pending' || status === 'ready_for_review' ? null : at;
      return true;
    },
    async claimReward(sid) {
      const s = subs.find((x) => x.id === sid);
      if (!s || s.rewarded) return false;
      s.rewarded = true;
      return true;
    },
    async list(status, limit) {
      return subs.filter((s) => !status || s.status === status).reverse().slice(0, limit).map((s) => ({ ...s, userName: s.userId }));
    },
  };
}
