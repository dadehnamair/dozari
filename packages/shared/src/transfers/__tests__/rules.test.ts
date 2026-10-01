import { describe, expect, it } from 'vitest';
import { repayAmount, transferBlock, weeklyLeft } from '../rules.js';
import type { TransferContext, TransferRules } from '../rules.js';

const rules: TransferRules = { gifts: true, loans: true, minFriendDays: 7, minLevel: 5, weeklyCap: 200, minAmount: 10, maxAmount: 100, loanDueDays: 7, loanMaxOpen: 1, needsActivation: true };
const ok: TransferContext = { kind: 'gift', amount: 50, level: 5, activated: true, friendDays: 7, sentThisWeek: 0 };

describe('transferBlock', () => {
  it('allows a valid transfer', () => {
    expect(transferBlock(ok, rules)).toBeNull();
    expect(transferBlock({ ...ok, kind: 'loan' }, rules)).toBeNull();
  });
  it('reports the first failing rule in order', () => {
    expect(transferBlock(ok, { ...rules, gifts: false })).toBe('OFF');
    expect(transferBlock({ ...ok, kind: 'loan' }, { ...rules, loans: false })).toBe('OFF');
    expect(transferBlock({ ...ok, activated: false, level: 1 }, rules)).toBe('NOT_ACTIVATED');
    expect(transferBlock({ ...ok, level: 4 }, rules)).toBe('LEVEL');
    expect(transferBlock({ ...ok, friendDays: null }, rules)).toBe('NOT_FRIENDS');
    expect(transferBlock({ ...ok, friendDays: 6 }, rules)).toBe('TOO_NEW');
  });
  it('limits the amount and the weekly total', () => {
    expect(transferBlock({ ...ok, amount: 9 }, rules)).toBe('AMOUNT');
    expect(transferBlock({ ...ok, amount: 101 }, rules)).toBe('AMOUNT');
    expect(transferBlock({ ...ok, amount: 10.5 }, rules)).toBe('AMOUNT');
    expect(transferBlock({ ...ok, amount: 100, sentThisWeek: 100 }, rules)).toBeNull();
    expect(transferBlock({ ...ok, amount: 100, sentThisWeek: 101 }, rules)).toBe('CAP');
  });
  it('knows what is left and what a repayment can take', () => {
    expect(weeklyLeft(150, rules)).toBe(50);
    expect(weeklyLeft(999, rules)).toBe(0);
    expect(repayAmount(80, 60, 500)).toBe(60);
    expect(repayAmount(80, 60, 25)).toBe(25);
    expect(repayAmount(0, 60, 25)).toBe(0);
  });
});
