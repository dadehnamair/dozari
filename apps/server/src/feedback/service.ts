import type { FeedCard, ReportInput, SubmissionInput, SubmissionStatus } from '@dozari/shared';
import { toRials } from '@dozari/shared';
import type { AdminReport, AdminSubmission, FeedbackStore, SubmissionRow } from './store.js';

const DAY_MS = 86_400_000;

export interface FeedbackRules {
  dailyLimit: number;
  voterMinGames: number;
  approveScore: number;
  rejectScore: number;
  rewardCoins: number;
  reportDailyLimit: number;
}

export interface FeedbackDeps {
  store: FeedbackStore;
  rules(): Promise<FeedbackRules>;
  /** Finished games of a player (the voter gate). */
  games(userId: string): Promise<number>;
  userExists(userId: string): Promise<boolean>;
  /** The catalog: every product id and name (for «this item already exists» and card titles). */
  products(): Promise<{ id: string; nameFa: string }[]>;
  /** Pays the approval reward through the coin ledger; idempotent per submission. */
  reward(userId: string, submissionId: string, coins: number): Promise<void>;
  /** Hands an approved suggestion to the catalog review (always stored as pending there). */
  catalog: {
    createProduct(input: { slug: string; nameFa: string; category: string; unitFa: string | null }): Promise<{ id: string } | 'duplicate' | 'invalid'>;
    addPrice(input: { productId: string; year: number; priceRials: bigint; sourceType: 'website' | 'user_memory' | 'other'; sourceNote: string; confidence: number }): Promise<{ id: string } | 'duplicate' | 'not_found'>;
  };
  now?: () => number;
}

export type ReportResult = 'ok' | 'self' | 'unknown_user' | 'duplicate' | 'limit';
export type SubmitResult = { ok: true; id: string } | { ok: false; error: 'limit' | 'unknown_product' | 'duplicate' | 'invalid'; productId?: string };
export type VoteResult = { ok: true; status: SubmissionStatus } | { ok: false; error: 'locked' | 'not_found' | 'own' | 'voted' | 'closed' };
export type DecideResult = { ok: true; productId?: string } | { ok: false; error: 'not_found' | 'closed' | 'duplicate' | 'invalid' };

/** Names compared without spacing, ZWNJ, Arabic letter forms or digit style: «پفک نمکی» = «پفک‌نمکی». */
export function normalizeName(s: string): string {
  return s
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\s‌‏‎]/g, '')
    .toLowerCase();
}

/** Reports of players and the suggestion / vote / approve loop (docs/logic/ugc.md). */
export class FeedbackService {
  constructor(private readonly deps: FeedbackDeps) {}
  private now = () => (this.deps.now ?? Date.now)();

  async report(reporterId: string, input: ReportInput): Promise<ReportResult> {
    if (reporterId === input.targetId) return 'self';
    if (!(await this.deps.userExists(input.targetId))) return 'unknown_user';
    const rules = await this.deps.rules();
    if ((await this.deps.store.reportsSince(reporterId, this.now() - DAY_MS)) >= rules.reportDailyLimit) return 'limit';
    if (await this.deps.store.hasOpenReport(reporterId, input.targetId)) return 'duplicate';
    await this.deps.store.addReport({ reporterId, targetId: input.targetId, category: input.category, details: input.details });
    return 'ok';
  }

  async submit(userId: string, input: SubmissionInput): Promise<SubmitResult> {
    const rules = await this.deps.rules();
    if ((await this.deps.store.submissionsSince(userId, this.now() - DAY_MS)) >= rules.dailyLimit) return { ok: false, error: 'limit' };
    const products = await this.deps.products();
    let nameFa = input.nameFa ?? '';
    if (input.kind === 'item') {
      const key = normalizeName(nameFa);
      const same = products.find((p) => normalizeName(p.nameFa) === key);
      if (same) return { ok: false, error: 'duplicate', productId: same.id };
    } else {
      const p = products.find((x) => x.id === input.productId);
      if (!p) return { ok: false, error: 'unknown_product' };
      nameFa = p.nameFa;
    }
    const row = await this.deps.store.addSubmission({
      userId,
      kind: input.kind,
      productId: input.kind === 'item' ? null : (input.productId ?? null),
      nameFa,
      category: input.kind === 'item' ? (input.category ?? null) : null,
      unitFa: input.unitFa || null,
      year: input.year ?? null,
      priceRials: input.price === undefined ? null : toRials(input.price, input.unit),
      sourceType: input.sourceType,
      sourceText: input.sourceText,
      note: input.note,
    });
    return { ok: true, id: row.id };
  }

  /** The next card to vote on; `locked` until the player has finished enough games. */
  async feed(userId: string): Promise<{ locked: true; need: number } | { locked: false; card: FeedCard | null }> {
    const rules = await this.deps.rules();
    if ((await this.deps.games(userId)) < rules.voterMinGames) return { locked: true, need: rules.voterMinGames };
    const s = await this.deps.store.nextToVote(userId);
    return { locked: false, card: s ? { id: s.id, kind: s.kind, nameFa: s.nameFa, year: s.year, priceRials: s.priceRials, sourceType: s.sourceType, sourceText: s.sourceText, note: s.note } : null };
  }

  async vote(userId: string, id: string, value: 1 | -1): Promise<VoteResult> {
    const rules = await this.deps.rules();
    if ((await this.deps.games(userId)) < rules.voterMinGames) return { ok: false, error: 'locked' };
    const s = await this.deps.store.submission(id);
    if (!s) return { ok: false, error: 'not_found' };
    if (s.userId === userId) return { ok: false, error: 'own' };
    if (s.status !== 'pending') return { ok: false, error: 'closed' };
    const out = await this.deps.store.vote(id, userId, value);
    if (out === 'not_found') return { ok: false, error: 'not_found' };
    if (out === 'voted') return { ok: false, error: 'voted' };
    let status: SubmissionStatus = 'pending';
    if (out.score >= rules.approveScore) status = 'ready_for_review';
    else if (out.score <= -rules.rejectScore) status = 'rejected';
    if (status !== 'pending') await this.deps.store.setStatus(id, status, this.now());
    return { ok: true, status };
  }

  // ----- admin -----
  reports(limit = 100): Promise<AdminReport[]> {
    return this.deps.store.reports(limit);
  }
  resolveReport(id: string): Promise<boolean> {
    return this.deps.store.resolveReport(id);
  }
  list(status: SubmissionStatus | null, limit = 100): Promise<AdminSubmission[]> {
    return this.deps.store.list(status, limit);
  }

  /** Approve: an item becomes a product, a price becomes a price point (both pending in the catalog review), the suggester is paid once. */
  async approve(id: string): Promise<DecideResult> {
    const s = await this.deps.store.submission(id);
    if (!s) return { ok: false, error: 'not_found' };
    if (s.status !== 'pending' && s.status !== 'ready_for_review') return { ok: false, error: 'closed' };
    let productId = s.productId ?? undefined;
    if (s.kind === 'item') {
      const made = await this.deps.catalog.createProduct({ slug: `ugc-${id.replace(/-/g, '').slice(-14)}`, nameFa: s.nameFa, category: s.category ?? 'other', unitFa: s.unitFa });
      if (made === 'duplicate' || made === 'invalid') return { ok: false, error: made };
      productId = made.id;
    }
    if (s.kind !== 'price_report' && productId && s.year !== null && s.priceRials !== null) {
      const price = await this.deps.catalog.addPrice({ productId, year: s.year, priceRials: BigInt(s.priceRials), sourceType: s.sourceType, sourceNote: s.sourceText || s.note, confidence: s.sourceType === 'user_memory' ? 1 : 2 });
      if (price === 'not_found') return { ok: false, error: 'invalid' };
    }
    if (!(await this.deps.store.setStatus(id, 'approved', this.now()))) return { ok: false, error: 'closed' };
    await this.pay(s);
    return { ok: true, productId };
  }

  async reject(id: string): Promise<DecideResult> {
    const s = await this.deps.store.submission(id);
    if (!s) return { ok: false, error: 'not_found' };
    if (!(await this.deps.store.setStatus(id, 'rejected', this.now()))) return { ok: false, error: 'closed' };
    return { ok: true };
  }

  private async pay(s: SubmissionRow): Promise<void> {
    const { rewardCoins } = await this.deps.rules();
    if (rewardCoins > 0 && (await this.deps.store.claimReward(s.id, this.now()))) await this.deps.reward(s.userId, s.id, rewardCoins);
  }
}
