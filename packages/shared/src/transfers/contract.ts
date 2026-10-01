import { z } from 'zod';

export const transferRulesViewSchema = z.object({
  gifts: z.boolean(),
  loans: z.boolean(),
  minFriendDays: z.number().int(),
  minLevel: z.number().int(),
  weeklyCap: z.number().int(),
  minAmount: z.number().int(),
  maxAmount: z.number().int(),
  loanDueDays: z.number().int(),
  loanMaxOpen: z.number().int(),
  needsActivation: z.boolean(),
});

/** `GET /transfers/rules`: the rules (shown before first use) and how much this player may still send. */
export const transferInfoSchema = z.object({
  rules: transferRulesViewSchema,
  level: z.number().int().positive(),
  activated: z.boolean(),
  sentThisWeek: z.number().int().nonnegative(),
  leftThisWeek: z.number().int().nonnegative(),
  balance: z.number().int().nonnegative(),
});
export type TransferInfo = z.infer<typeof transferInfoSchema>;

export const TRANSFER_STATUSES = ['completed', 'offered', 'open', 'repaid', 'declined', 'cancelled'] as const;

export const transferRowSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['gift', 'loan']),
  status: z.enum(TRANSFER_STATUSES),
  amount: z.number().int().positive(),
  repaid: z.number().int().nonnegative(),
  /** Who is on the other side, from the caller's point of view. */
  direction: z.enum(['out', 'in']),
  otherId: z.string().uuid(),
  otherName: z.string(),
  dueAt: z.number().int().nullable(),
  overdue: z.boolean(),
  createdAt: z.number().int(),
});
export type TransferRow = z.infer<typeof transferRowSchema>;

export const transfersSchema = z.object({ transfers: z.array(transferRowSchema) });

export const TRANSFER_ERRORS = ['OFF', 'NOT_ACTIVATED', 'LEVEL', 'NOT_FRIENDS', 'TOO_NEW', 'AMOUNT', 'CAP', 'INSUFFICIENT', 'LOAN_LIMIT', 'OVERDUE', 'NOT_FOUND', 'LENDER_SHORT', 'BAD_STATE'] as const;
export type TransferError = (typeof TRANSFER_ERRORS)[number];
