export interface TransferRules {
  gifts: boolean;
  loans: boolean;
  minFriendDays: number;
  minLevel: number;
  weeklyCap: number;
  minAmount: number;
  maxAmount: number;
  loanDueDays: number;
  loanMaxOpen: number;
  /** The sender must have redeemed an invite code (an activated account). */
  needsActivation: boolean;
}

export type TransferBlock = 'OFF' | 'NOT_ACTIVATED' | 'LEVEL' | 'NOT_FRIENDS' | 'TOO_NEW' | 'AMOUNT' | 'CAP';

export interface TransferContext {
  kind: 'gift' | 'loan';
  amount: number;
  level: number;
  activated: boolean;
  /** Whole days the two have been friends; null when they are not friends. */
  friendDays: number | null;
  /** Coins this player already sent (gifts + loan principals) in the last 7 days. */
  sentThisWeek: number;
}

/** Why a gift or loan cannot be sent right now, or null when it can. The first failing rule wins, in this order. */
export function transferBlock(ctx: TransferContext, rules: TransferRules): TransferBlock | null {
  if (!(ctx.kind === 'gift' ? rules.gifts : rules.loans)) return 'OFF';
  if (rules.needsActivation && !ctx.activated) return 'NOT_ACTIVATED';
  if (ctx.level < rules.minLevel) return 'LEVEL';
  if (ctx.friendDays === null) return 'NOT_FRIENDS';
  if (ctx.friendDays < rules.minFriendDays) return 'TOO_NEW';
  if (!Number.isInteger(ctx.amount) || ctx.amount < rules.minAmount || ctx.amount > rules.maxAmount) return 'AMOUNT';
  if (ctx.sentThisWeek + ctx.amount > rules.weeklyCap) return 'CAP';
  return null;
}

/** Coins still sendable this week. */
export const weeklyLeft = (sentThisWeek: number, rules: Pick<TransferRules, 'weeklyCap'>): number => Math.max(0, rules.weeklyCap - sentThisWeek);

/** What a repayment can take: not more than is owed, not more than the borrower has. */
export const repayAmount = (requested: number, owed: number, balance: number): number => Math.max(0, Math.min(requested, owed, balance));
