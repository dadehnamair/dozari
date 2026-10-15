import { authorReward, blindOrder, isNearDuplicate, milestonesCrossed, reviewerTitle, tehranDayStart, workshopAutoState, workshopReviewScore } from '@dozari/shared';
import type { AuthorReward, WorkshopCard, WorkshopInfo, WorkshopMineRow, WorkshopRejectReason, WorkshopReview, WorkshopStatus, WorkshopSubmit } from '@dozari/shared';
import type { TriviaStore } from '../trivia/store.js';
import type { AdminSubmission, SubmissionRow, WorkshopStore } from './store.js';

export interface WorkshopRules {
  on: boolean;
  submitDaily: number;
  reviewDaily: number;
  reviewMinGames: number;
  approveScore: number;
  rejectScore: number;
  minReviewers: number;
  agreeBonus: number;
  milestonePoints: number;
  milestoneCoins: number;
  thinBelow: number;
  author: { coins: number; firstBonus: number; milestoneEvery: number; milestoneBonus: number; thinBonus: number; boostPercent: number };
}

export interface WorkshopDeps {
  store: WorkshopStore;
  trivia: TriviaStore;
  rules(): Promise<WorkshopRules>;
  /** Finished games of a player (the reviewer gate). */
  games(userId: string): Promise<number>;
  /** Pays coins through the ledger (reason `ugc_reward`); idempotent per key. */
  reward(userId: string, key: string, coins: number): Promise<void>;
  /** A short in-app message to one player (approved / rejected). Must not throw. */
  notify?(userId: string, title: string, body: string): Promise<void> | void;
  now?: () => number;
}

export type SubmitResult = { ok: true; id: string } | { ok: false; error: 'off' | 'limit' | 'unknown_topic' | 'duplicate' };
export type FeedResult = { locked: true; need: number } | { locked: false; capped: boolean; card: WorkshopCard | null };
export type ReviewResult = { ok: true; status: WorkshopStatus; points: number } | { ok: false; error: 'off' | 'locked' | 'not_found' | 'own' | 'reviewed' | 'closed' | 'daily_limit' };
export type DecideResult = { ok: true; questionId?: string; reward?: AuthorReward } | { ok: false; error: 'not_found' | 'closed' | 'unknown_topic' | 'invalid' };

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const BASE_REVIEW_POINTS = 1;

/** Players design questions, review each other's, and the admin decides (docs/logic/question-workshop.md). */
export class WorkshopService {
  constructor(private readonly deps: WorkshopDeps) {}
  private now = () => (this.deps.now ?? Date.now)();

  /** Start of the player's Tehran day (daily limits reset there). */
  private dayStart(): number {
    return tehranDayStart(this.now());
  }

  async info(userId: string): Promise<WorkshopInfo> {
    const r = await this.deps.rules();
    const [games, points, counts, waiting, submitted, reviewed] = await Promise.all([
      this.deps.games(userId),
      this.deps.store.points(userId),
      this.deps.store.counts(userId),
      this.deps.store.waitingFor(userId),
      this.deps.store.submissionsSince(userId, this.dayStart()),
      this.deps.store.reviewsSince(userId, this.dayStart()),
    ]);
    const title = reviewerTitle(points);
    const locked = games < r.reviewMinGames;
    return {
      on: r.on,
      // What an ordinary question pays today (no first / milestone / thin extras), campaign included.
      rewardCoins: authorReward(2, false, { ...r.author, milestoneEvery: 0 }).total,
      boostPercent: r.author.boostPercent,
      waiting: locked ? 0 : waiting,
      reviewLocked: locked,
      reviewMinGames: r.reviewMinGames,
      points,
      title: title.index,
      nextTitleAt: title.nextAt,
      approved: counts.approved,
      pending: counts.pending,
      rejected: counts.rejected,
      submitsLeftToday: Math.max(0, r.submitDaily - submitted),
      reviewsLeftToday: Math.max(0, r.reviewDaily - reviewed),
    };
  }

  /** Every active topic with how many approved questions it has and whether a new one pays the thin-topic bonus. */
  async topics() {
    const r = await this.deps.rules();
    return (await this.deps.trivia.topicCounts(['adult'])).map((t) => ({ id: t.id, nameFa: t.nameFa, questions: t.questions, thin: r.thinBelow > 0 && t.questions < r.thinBelow, bonus: r.thinBelow > 0 && t.questions < r.thinBelow ? r.author.thinBonus : 0 }));
  }

  async submit(userId: string, input: WorkshopSubmit): Promise<SubmitResult> {
    const r = await this.deps.rules();
    if (!r.on) return { ok: false, error: 'off' };
    if ((await this.deps.trivia.topicName(input.topicId)) === null) return { ok: false, error: 'unknown_topic' };
    if ((await this.deps.store.submissionsSince(userId, this.dayStart())) >= r.submitDaily) return { ok: false, error: 'limit' };
    const bank = (await this.deps.trivia.list({ topicId: input.topicId, status: 'approved', limit: 2000 })).map((q) => q.textFa);
    const open = await this.deps.store.openTexts(input.topicId);
    if (isNearDuplicate(input.textFa, [...bank, ...open])) return { ok: false, error: 'duplicate' };
    const row = await this.deps.store.add({ userId, topicId: input.topicId, textFa: input.textFa, options: input.options, correctIndex: input.correctIndex, explanationFa: input.explanationFa, difficulty: input.difficulty });
    return { ok: true, id: row.id };
  }

  async mine(userId: string): Promise<WorkshopMineRow[]> {
    return (await this.deps.store.mine(userId, 100)).map((m) => ({
      id: m.id,
      topicNameFa: m.topicNameFa,
      textFa: m.textFa,
      options: m.options,
      correctIndex: m.correctIndex,
      status: m.status,
      rejectReason: m.rejectReason,
      reviews: m.reviews,
      rewardCoins: m.rewardCoins,
      plays: m.plays,
      createdAt: m.createdAt,
      decidedAt: m.decidedAt,
    }));
  }

  private card(s: SubmissionRow, topicNameFa: string, reviewerId: string): WorkshopCard {
    const order = blindOrder(reviewerId, s.id);
    return { id: s.id, topicNameFa, textFa: s.textFa, options: order.map((i) => s.options[i]!), difficulty: s.difficulty };
  }

  /** The next card to review; `locked` until the player has finished enough games, `capped` once today's reviews are used up. */
  async feed(userId: string): Promise<FeedResult> {
    const r = await this.deps.rules();
    if ((await this.deps.games(userId)) < r.reviewMinGames) return { locked: true, need: r.reviewMinGames };
    if ((await this.deps.store.reviewsSince(userId, this.dayStart())) >= r.reviewDaily) return { locked: false, capped: true, card: null };
    const s = await this.deps.store.nextToReview(userId);
    if (!s) return { locked: false, capped: false, card: null };
    return { locked: false, capped: false, card: this.card(s, (await this.deps.trivia.topicName(s.topicId)) ?? '', userId) };
  }

  async review(userId: string, id: string, input: WorkshopReview): Promise<ReviewResult> {
    const r = await this.deps.rules();
    if (!r.on) return { ok: false, error: 'off' };
    if ((await this.deps.games(userId)) < r.reviewMinGames) return { ok: false, error: 'locked' };
    const s = await this.deps.store.get(id);
    if (!s) return { ok: false, error: 'not_found' };
    if (s.userId === userId) return { ok: false, error: 'own' };
    if (s.status !== 'pending') return { ok: false, error: 'closed' };
    if ((await this.deps.store.reviewsSince(userId, this.dayStart())) >= r.reviewDaily) return { ok: false, error: 'daily_limit' };
    // The reviewer answered in their own order; map it back to the author's.
    const original = blindOrder(userId, id)[input.answerIndex]!;
    const matches = original === s.correctIndex;
    const before = await this.deps.store.points(userId);
    const out = await this.deps.store.addReview(id, userId, { answerIndex: original, quality: input.quality, matches, points: BASE_REVIEW_POINTS, score: workshopReviewScore(matches, input.quality) });
    if (out === 'not_found') return { ok: false, error: 'not_found' };
    if (out === 'duplicate') return { ok: false, error: 'reviewed' };
    if (out === 'closed') return { ok: false, error: 'closed' };
    let status: WorkshopStatus = 'pending';
    const next = workshopAutoState(out.score, out.reviews, r);
    // The community turned it down: most reviewers picked another answer → the answer is in doubt, else it read badly.
    const why: WorkshopRejectReason = out.disputes * 2 >= out.reviews ? 'wrong_answer' : 'unclear';
    if (next !== 'pending' && (await this.deps.store.autoState(id, next, this.now(), why))) status = next;
    await this.payMilestones(userId, before, before + BASE_REVIEW_POINTS, r);
    if (status === 'rejected') await this.finishRejected(s, why, true);
    return { ok: true, status, points: BASE_REVIEW_POINTS };
  }

  private async payMilestones(userId: string, before: number, after: number, r: WorkshopRules): Promise<void> {
    if (r.milestoneCoins <= 0) return;
    for (const n of milestonesCrossed(before, after, r.milestonePoints)) await this.deps.reward(userId, `trivia_review:${userId}:${n}`, r.milestoneCoins);
  }

  async top(userId: string, period: 'week' | 'all') {
    const since = period === 'week' ? this.now() - WEEK_MS : null;
    const [authors, reviewers] = await Promise.all([this.deps.store.topAuthors(since, 10), this.deps.store.topReviewers(since, 10)]);
    return {
      authors: authors.map((a) => ({ nickname: a.nickname, approved: a.approved, you: a.userId === userId })),
      reviewers: reviewers.map((v) => ({ nickname: v.nickname, points: v.points, title: reviewerTitle(v.points).index, you: v.userId === userId })),
    };
  }

  // ----- admin -----
  list(status: WorkshopStatus | null, limit = 150): Promise<AdminSubmission[]> {
    return this.deps.store.list(status, limit);
  }

  /** Approve (as is, or with the admin's edits): the question goes live under the author's name and the author is paid once. */
  async approve(id: string, edit?: WorkshopSubmit): Promise<DecideResult> {
    const s = await this.deps.store.get(id);
    if (!s) return { ok: false, error: 'not_found' };
    if (s.status !== 'pending' && s.status !== 'ready_for_review') return { ok: false, error: 'closed' };
    const final = edit ?? { topicId: s.topicId, textFa: s.textFa, options: s.options, correctIndex: s.correctIndex, explanationFa: s.explanationFa, difficulty: s.difficulty };
    if ((await this.deps.trivia.topicName(final.topicId)) === null) return { ok: false, error: 'unknown_topic' };
    const r = await this.deps.rules();
    // How thin the topic is, and the author's count, as they stand before this question joins them.
    const topic = (await this.deps.trivia.topicCounts(['adult'])).find((t) => t.id === final.topicId);
    const thin = r.thinBelow > 0 && (topic?.questions ?? 0) < r.thinBelow;
    const approvedBefore = await this.deps.store.approvedCount(s.userId);
    if (!(await this.deps.store.decide(id, 'approved', this.now()))) return { ok: false, error: 'closed' };
    const made = await this.deps.trivia.create({ ...final, ageTrack: 'adult' }, 'approved', s.userId);
    if (!made.ok) return { ok: false, error: 'invalid' };
    const reward = authorReward(approvedBefore + 1, thin, r.author);
    await this.deps.store.attachQuestion(id, made.id, reward.total);
    if (reward.total > 0) await this.deps.reward(s.userId, `trivia_author:${id}`, reward.total);
    const settled = await this.deps.store.settle(id, final.correctIndex, 'approved', r.agreeBonus, this.now());
    for (const p of settled) await this.payMilestones(p.reviewerId, p.before, p.after, r);
    await this.tell(s.userId, 'سؤالت تأیید شد 🎉', `سؤال «${final.textFa.slice(0, 60)}» تأیید شد و از حالا در بازی‌ها می‌آید با نام تو. ${reward.total > 0 ? `${reward.total} سکه جایزه گرفتی.` : ''}`);
    return { ok: true, questionId: made.id, reward };
  }

  async reject(id: string, reason: WorkshopRejectReason): Promise<DecideResult> {
    const s = await this.deps.store.get(id);
    if (!s) return { ok: false, error: 'not_found' };
    if (!(await this.deps.store.decide(id, 'rejected', this.now(), reason))) return { ok: false, error: 'closed' };
    await this.finishRejected(s, reason, true);
    return { ok: true };
  }

  /** A rejected submission settles its reviews (a 👎 with the right pick pays the agreement bonus) and tells the author why. */
  private async finishRejected(s: SubmissionRow, reason: WorkshopRejectReason, tellAuthor: boolean): Promise<void> {
    const r = await this.deps.rules();
    const settled = await this.deps.store.settle(s.id, s.correctIndex, 'rejected', r.agreeBonus, this.now());
    for (const p of settled) await this.payMilestones(p.reviewerId, p.before, p.after, r);
    if (tellAuthor) await this.tell(s.userId, 'سؤالت این بار تأیید نشد', `دلیل: ${REASON_FA[reason]}. ناراحت نشو؛ یکی دیگر بساز!`);
  }

  private async tell(userId: string, title: string, body: string): Promise<void> {
    try {
      await this.deps.notify?.(userId, title, body);
    } catch {
      /* a message must never break a decision */
    }
  }
}

/** The reasons as the author reads them in the inbox (the app shows its own labels from `fa.workshop.reasons`). */
const REASON_FA: Record<WorkshopRejectReason, string> = {
  wrong_answer: 'جواب درست سؤال اشتباه یا قابل بحث بود',
  unclear: 'صورت سؤال یا گزینه‌ها مبهم بود',
  duplicate: 'سؤال مشابه‌اش از قبل در بازی هست',
  off_topic: 'سؤال به موضوع انتخاب‌شده نمی‌خورد',
  bad_taste: 'محتوای سؤال مناسب بازی نبود',
};
