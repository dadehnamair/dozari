import { repayAmount, transferBlock, weeklyLeft } from '@dozari/shared';
import type { TransferContext, TransferError, TransferInfo, TransferRow, TransferRules } from '@dozari/shared';
import type { SettingsService } from '../settings/service.js';
import type { SocialStore } from '../social/store.js';
import type { TransferRecord, TransferStore } from './store.js';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export async function transferRulesFromSettings(settings: SettingsService): Promise<TransferRules> {
  const n = (k: string) => settings.num(k);
  const [gifts, loans, minFriendDays, minLevel, weeklyCap, minAmount, maxAmount, needsActivation, loanDueDays, loanMaxOpen] = await Promise.all(
    ['transfer.gifts_on', 'transfer.loans_on', 'transfer.min_friend_days', 'transfer.min_level', 'transfer.weekly_cap', 'transfer.min_amount', 'transfer.max_amount', 'transfer.needs_activation', 'loan.due_days', 'loan.max_open'].map(n),
  );
  return { gifts: gifts === 1, loans: loans === 1, minFriendDays: minFriendDays!, minLevel: minLevel!, weeklyCap: weeklyCap!, minAmount: minAmount!, maxAmount: Math.max(maxAmount!, minAmount!), loanDueDays: loanDueDays!, loanMaxOpen: loanMaxOpen!, needsActivation: needsActivation === 1 };
}

export type SendResult = { ok: true; balance: number; id?: string } | { ok: false; error: TransferError };

/** Gifts and loans between friends: the rules are checked here, the coins move in the store. */
export class TransferService {
  constructor(
    private readonly store: TransferStore,
    private readonly social: Pick<SocialStore, 'pair' | 'publicRow'>,
    private readonly rules: () => Promise<TransferRules>,
    private readonly levelOf: (userId: string) => Promise<number>,
    private readonly isActivated: (userId: string) => Promise<boolean>,
    private readonly now: () => number = Date.now,
  ) {}

  async info(userId: string): Promise<TransferInfo> {
    const [rules, level, activated, sent, me] = await Promise.all([this.rules(), this.levelOf(userId), this.isActivated(userId), this.store.sentSince(userId, this.now() - WEEK_MS), this.social.publicRow(userId)]);
    return { rules, level, activated, sentThisWeek: sent, leftThisWeek: weeklyLeft(sent, rules), balance: me?.coins ?? 0 };
  }

  private async check(kind: 'gift' | 'loan', from: string, to: string, amount: number): Promise<TransferError | null> {
    if (from === to) return 'NOT_FRIENDS';
    const [rules, level, activated, sent, pair, target] = await Promise.all([
      this.rules(),
      this.levelOf(from),
      this.isActivated(from),
      this.store.sentSince(from, this.now() - WEEK_MS),
      this.social.pair(from, to),
      this.social.publicRow(to),
    ]);
    const since = pair?.status === 'accepted' && pair.acceptedAt !== null ? Math.floor((this.now() - pair.acceptedAt) / DAY_MS) : null;
    const ctx: TransferContext = { kind, amount, level, activated, friendDays: target ? since : null, sentThisWeek: sent };
    return transferBlock(ctx, rules);
  }

  async gift(from: string, to: string, amount: number): Promise<SendResult> {
    const blocked = await this.check('gift', from, to, amount);
    if (blocked) return { ok: false, error: blocked };
    const out = await this.store.sendGift(from, to, amount);
    return out.ok ? out : { ok: false, error: 'INSUFFICIENT' };
  }

  /** The lender offers; no coins move until the borrower accepts. The offer already counts toward the lender's weekly cap. */
  async offerLoan(from: string, to: string, amount: number): Promise<SendResult> {
    const blocked = await this.check('loan', from, to, amount);
    if (blocked) return { ok: false, error: blocked };
    await this.collectDue(to);
    if ((await this.store.dueLoans(to, this.now())).length > 0) return { ok: false, error: 'OVERDUE' };
    if ((await this.store.activeLoanCount(to)) >= (await this.rules()).loanMaxOpen) return { ok: false, error: 'LOAN_LIMIT' };
    const r = await this.store.offerLoan(from, to, amount);
    return { ok: true, balance: (await this.social.publicRow(from))?.coins ?? 0, id: r.id };
  }

  async acceptLoan(borrower: string, id: string): Promise<SendResult> {
    const rules = await this.rules();
    await this.collectDue(borrower);
    if ((await this.store.dueLoans(borrower, this.now())).length > 0) return { ok: false, error: 'OVERDUE' };
    const out = await this.store.acceptLoan(id, borrower, this.now() + rules.loanDueDays * DAY_MS);
    if (out === 'ok') return { ok: true, balance: (await this.social.publicRow(borrower))?.coins ?? 0 };
    return { ok: false, error: out === 'not_found' ? 'NOT_FOUND' : out === 'lender_short' ? 'LENDER_SHORT' : 'BAD_STATE' };
  }

  async closeOffer(by: string, id: string, as: 'declined' | 'cancelled'): Promise<SendResult> {
    const out = await this.store.closeOffer(id, by, as);
    return out === 'ok' ? { ok: true, balance: 0 } : { ok: false, error: out === 'not_found' ? 'NOT_FOUND' : 'BAD_STATE' };
  }

  async repay(borrower: string, id: string, amount: number): Promise<{ ok: true; paid: number; remaining: number; balance: number } | { ok: false; error: TransferError }> {
    if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: 'AMOUNT' };
    const out = await this.store.repay(id, borrower, amount);
    if (out.ok) return out;
    return { ok: false, error: out.error === 'not_found' ? 'NOT_FOUND' : 'BAD_STATE' };
  }

  /** Past-due loans are paid from whatever the borrower has (never below zero); what is left stays owed and blocks new loans. */
  async collectDue(borrower: string): Promise<void> {
    for (const loan of await this.store.dueLoans(borrower, this.now())) {
      const wallet = (await this.social.publicRow(borrower))?.coins ?? 0;
      const pay = repayAmount(loan.amount - loan.repaid, loan.amount - loan.repaid, wallet);
      if (pay > 0) await this.store.repay(loan.id, borrower, pay);
    }
  }

  async list(userId: string): Promise<TransferRow[]> {
    await this.collectDue(userId);
    const rows = await this.store.list(userId, 50);
    const names = new Map<string, string>();
    const nameOf = async (id: string) => {
      if (!names.has(id)) names.set(id, (await this.social.publicRow(id))?.nickname ?? '؟');
      return names.get(id) as string;
    };
    const out: TransferRow[] = [];
    for (const r of rows) out.push(await this.view(userId, r, nameOf));
    return out;
  }

  private async view(userId: string, r: TransferRecord, nameOf: (id: string) => Promise<string>): Promise<TransferRow> {
    const direction = r.fromUserId === userId ? 'out' : 'in';
    const other = direction === 'out' ? r.toUserId : r.fromUserId;
    return { id: r.id, kind: r.kind, status: r.status, amount: r.amount, repaid: r.repaid, direction, otherId: other, otherName: await nameOf(other), dueAt: r.dueAt, overdue: r.status === 'open' && r.dueAt !== null && r.dueAt <= this.now(), createdAt: r.createdAt };
  }
}
