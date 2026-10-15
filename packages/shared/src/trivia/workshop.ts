import { z } from 'zod';
import { WORKSHOP_TITLE_POINTS } from '../config/topics.js';
import { mulberry32, shuffled } from '../game/rng.js';
import { triviaInputSchema } from './contract.js';

/** The question workshop (docs/logic/question-workshop.md): pure rules and the wire shapes. */

export const WORKSHOP_STATUSES = ['pending', 'ready_for_review', 'approved', 'rejected'] as const;
export type WorkshopStatus = (typeof WORKSHOP_STATUSES)[number];
/** Why the admin turned a question down; the label lives in `fa.workshop.reasons`. */
export const WORKSHOP_REJECT_REASONS = ['wrong_answer', 'unclear', 'duplicate', 'off_topic', 'bad_taste'] as const;
export type WorkshopRejectReason = (typeof WORKSHOP_REJECT_REASONS)[number];

/** What a player sends: the question the admin would write, without the age track (the workshop is adult only for now). */
export const workshopSubmitSchema = triviaInputSchema.innerType().omit({ ageTrack: true }).refine((q) => new Set(q.options.map((o) => normalizeFa(o))).size === q.options.length, { message: 'options must be different', path: ['options'] });
export type WorkshopSubmit = z.infer<typeof workshopSubmitSchema>;

/** A reviewer's verdict on a card: which choice they think is right (as shown to them) and a thumb. */
export const workshopReviewSchema = z.object({ answerIndex: z.number().int().min(0).max(3), quality: z.union([z.literal(1), z.literal(-1)]) });
export type WorkshopReview = z.infer<typeof workshopReviewSchema>;

/** One card of the review feed: the question without the author's answer, the choices in this reviewer's own order. */
export const workshopCardSchema = z.object({ id: z.string().uuid(), topicNameFa: z.string(), textFa: z.string(), options: z.array(z.string()).length(4), difficulty: z.number().int().min(1).max(3) });
export type WorkshopCard = z.infer<typeof workshopCardSchema>;

export const workshopMineRowSchema = z.object({
  id: z.string().uuid(),
  topicNameFa: z.string(),
  textFa: z.string(),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().int().min(0).max(3),
  status: z.enum(WORKSHOP_STATUSES),
  rejectReason: z.enum(WORKSHOP_REJECT_REASONS).nullable(),
  reviews: z.number().int().nonnegative(),
  /** Coins paid for it (0 until approved). */
  rewardCoins: z.number().int().nonnegative(),
  /** Times the approved question was answered in games. */
  plays: z.number().int().nonnegative(),
  createdAt: z.number().int(),
  decidedAt: z.number().int().nullable(),
});
export type WorkshopMineRow = z.infer<typeof workshopMineRowSchema>;

export const workshopTopicSchema = z.object({ id: z.string().uuid(), nameFa: z.string(), questions: z.number().int().nonnegative(), thin: z.boolean(), bonus: z.number().int().nonnegative() });

/** The Workshop header and the Home card: the reward on offer, what waits for the player's review, and where they stand. */
export const workshopInfoSchema = z.object({
  on: z.boolean(),
  /** Coins an ordinary approved question pays now (base, with a running campaign applied), and the campaign percent (0 = none). */
  rewardCoins: z.number().int().nonnegative(),
  boostPercent: z.number().int().nonnegative(),
  /** Submissions waiting for this player's review (never their own, not yet reviewed by them). */
  waiting: z.number().int().nonnegative(),
  /** The reviewer feed opens at this many finished games; `locked` while the player has fewer. */
  reviewLocked: z.boolean(),
  reviewMinGames: z.number().int().nonnegative(),
  points: z.number().int().nonnegative(),
  title: z.number().int().min(0).max(WORKSHOP_TITLE_POINTS.length - 1),
  nextTitleAt: z.number().int().nullable(),
  approved: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  submitsLeftToday: z.number().int().nonnegative(),
  reviewsLeftToday: z.number().int().nonnegative(),
});
export type WorkshopInfo = z.infer<typeof workshopInfoSchema>;

export const workshopTopSchema = z.object({
  authors: z.array(z.object({ nickname: z.string(), approved: z.number().int().nonnegative(), you: z.boolean() })),
  reviewers: z.array(z.object({ nickname: z.string(), points: z.number().int().nonnegative(), title: z.number().int().min(0), you: z.boolean() })),
});

// ---- rules ----------------------------------------------------------------------------------------------------

/** Persian text compared without spacing, ZWNJ, Arabic letter forms, digit style or punctuation. */
export function normalizeFa(s: string): string {
  return s
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\s‌‏‎؟?!.,،:؛;()«»"'\-–—]/g, '')
    .toLowerCase();
}

const words = (s: string): Set<string> =>
  new Set(
    s
      .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
      .toLowerCase()
      .split(/[\s‌‏‎؟?!.,،:؛;()«»"'\-–—]+/)
      .filter((w) => w.length > 1),
  );

/** Share of words two question texts have in common (Jaccard, 0–1). */
export function textSimilarity(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (x.size === 0 || y.size === 0) return 0;
  let both = 0;
  for (const w of x) if (y.has(w)) both += 1;
  return both / (x.size + y.size - both);
}

/** A new question is a near-duplicate when its text equals or overlaps an existing one this much. */
export const WORKSHOP_DUPLICATE_SIMILARITY = 0.8;
export function isNearDuplicate(text: string, others: readonly string[]): boolean {
  const key = normalizeFa(text);
  return others.some((o) => normalizeFa(o) === key || textSimilarity(text, o) >= WORKSHOP_DUPLICATE_SIMILARITY);
}

/** The order in which one reviewer sees the four choices of a card: stable for that reviewer and card, different between reviewers. `order[shown] = original index`. */
export function blindOrder(reviewerId: string, submissionId: string): number[] {
  let h = 2166136261;
  for (const c of `${reviewerId}|${submissionId}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return shuffled([0, 1, 2, 3], mulberry32(h));
}

/** Score of one review: +1 / −1 for agreeing with the author's answer, plus the thumb (−2…+2). */
export const workshopReviewScore = (answerMatches: boolean, quality: 1 | -1): number => (answerMatches ? 1 : -1) + quality;

export interface WorkshopRules {
  approveScore: number;
  rejectScore: number;
  minReviewers: number;
}
/** Where a submission goes after a review: into the admin queue, out, or stays. */
export function workshopAutoState(score: number, reviews: number, rules: WorkshopRules): 'pending' | 'ready_for_review' | 'rejected' {
  if (score <= -rules.rejectScore) return 'rejected';
  if (score >= rules.approveScore && reviews >= rules.minReviewers) return 'ready_for_review';
  return 'pending';
}

export interface AuthorRewardRules {
  coins: number;
  firstBonus: number;
  milestoneEvery: number;
  milestoneBonus: number;
  thinBonus: number;
  boostPercent: number;
}
export interface AuthorReward {
  base: number;
  first: number;
  milestone: number;
  thin: number;
  /** What the campaign added on top of the parts above. */
  boost: number;
  total: number;
}
/** What the author is paid when this is their `approvedCount`-th approved question (1-based) in a topic that was `thin` or not. */
export function authorReward(approvedCount: number, thin: boolean, rules: AuthorRewardRules): AuthorReward {
  const base = Math.max(0, rules.coins);
  const first = approvedCount === 1 ? Math.max(0, rules.firstBonus) : 0;
  const milestone = rules.milestoneEvery > 0 && approvedCount % rules.milestoneEvery === 0 ? Math.max(0, rules.milestoneBonus) : 0;
  const thinBonus = thin ? Math.max(0, rules.thinBonus) : 0;
  const parts = base + first + milestone + thinBonus;
  const boost = Math.floor((parts * Math.max(0, rules.boostPercent)) / 100);
  return { base, first, milestone, thin: thinBonus, boost, total: parts + boost };
}

/** Points a settled review is worth in total: the base point, plus the agreement bonus when the blind pick and the thumb both matched the outcome. */
export function reviewSettlePoints(basePoints: number, agreed: boolean, bonus: number): number {
  return basePoints + (agreed ? Math.max(0, bonus) : 0);
}

/** Did this reviewer agree with how it ended? Their blind pick was the author's answer and their thumb matched the decision. */
export function reviewAgreed(answerMatches: boolean, quality: 1 | -1, outcome: 'approved' | 'rejected'): boolean {
  return answerMatches && quality === (outcome === 'approved' ? 1 : -1);
}

/** How many coin milestones lie between two point totals (`every` = 0 means none). */
export function milestonesCrossed(before: number, after: number, every: number): number[] {
  if (every <= 0 || after <= before) return [];
  const out: number[] = [];
  for (let n = Math.floor(before / every) + 1; n <= Math.floor(after / every); n++) out.push(n);
  return out;
}

/** Index into `WORKSHOP_TITLE_POINTS` (and `fa.workshop.titles`) for a point total, and the points needed for the next title. */
export function reviewerTitle(points: number): { index: number; nextAt: number | null } {
  let index = 0;
  WORKSHOP_TITLE_POINTS.forEach((p, i) => {
    if (points >= p) index = i;
  });
  return { index, nextAt: WORKSHOP_TITLE_POINTS[index + 1] ?? null };
}
