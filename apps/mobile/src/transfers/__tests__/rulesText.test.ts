import { describe, expect, it } from 'vitest';
import type { TransferInfo } from '@dozari/shared';
import { amountChoices, transferErrorText, transferRuleLines } from '../rulesText';

const info: TransferInfo = {
  rules: { gifts: true, loans: true, minFriendDays: 7, minLevel: 5, weeklyCap: 200, minAmount: 10, maxAmount: 100, loanDueDays: 7, loanMaxOpen: 1, needsActivation: true },
  level: 5, activated: true, sentThisWeek: 50, leftThisWeek: 150, balance: 300,
};

describe('transfer texts', () => {
  it('lists the live rules, with loan lines only for loans', () => {
    const gift = transferRuleLines(info, 'gift');
    expect(gift).toHaveLength(5);
    expect(gift.join(' ')).toContain('۷ روز');
    expect(gift.join(' ')).toContain('۱۵۰');
    expect(transferRuleLines(info, 'loan')).toHaveLength(7);
    expect(transferRuleLines({ ...info, rules: { ...info.rules, needsActivation: false } }, 'gift')).toHaveLength(4);
  });
  it('offers amounts inside the limits and the weekly room', () => {
    const c = amountChoices(info);
    expect(c[0]).toBe(10);
    expect(c[c.length - 1]).toBe(100);
    expect(c.every((n) => n >= 10 && n <= 100)).toBe(true);
    expect(amountChoices({ ...info, leftThisWeek: 30 }).pop()).toBe(30);
    expect(amountChoices({ ...info, leftThisWeek: 5 })).toEqual([]);
  });
  it('maps server error codes to Persian', () => {
    expect(transferErrorText('CAP')).toContain('هفتگی');
    expect(transferErrorText('???')).toBe('نتوانستیم انجام بدهیم.');
  });
});
