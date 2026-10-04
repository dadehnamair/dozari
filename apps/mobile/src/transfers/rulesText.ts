import type { TransferInfo } from '@dozari/shared';
import { fa } from '../i18n/fa';

/** The rules as short Persian lines, read from the live admin settings, shown before a player first sends coins. */
export function transferRuleLines(info: TransferInfo, kind: 'gift' | 'loan'): string[] {
  const r = info.rules;
  const t = fa.transfers.rule;
  const lines = [t.friends(r.minFriendDays), t.level(r.minLevel), t.amount(r.minAmount, r.maxAmount), t.weekly(r.weeklyCap, info.leftThisWeek)];
  if (r.needsActivation) lines.push(t.activation);
  if (kind === 'loan') lines.push(t.loanDue(r.loanDueDays), t.loanLimit(r.loanMaxOpen));
  return lines;
}

/** Quick amounts to tap: the minimum, the maximum and a few steps between, capped by what is left this week. */
export function amountChoices(info: Pick<TransferInfo, 'rules' | 'leftThisWeek'>): number[] {
  const { minAmount, maxAmount } = info.rules;
  const top = Math.min(maxAmount, info.leftThisWeek);
  if (top < minAmount) return [];
  const steps = [minAmount, Math.round((minAmount + top) / 4 / 5) * 5, Math.round((minAmount + top) / 2 / 5) * 5, top];
  return [...new Set(steps.filter((n) => n >= minAmount && n <= top))].sort((a, b) => a - b);
}

export function transferErrorText(code: string): string {
  return fa.transfers.errors[code] ?? fa.transfers.errors.generic ?? '';
}
