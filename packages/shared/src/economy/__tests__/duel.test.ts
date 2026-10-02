import { describe, expect, it } from 'vitest';
import { BROKE_RESCUE_TARGET, DAILY_FREE_MATCHES, ENTRY_FEE_BASE, FREE_MATCH_PAYOUT_PERCENT, HOUSE_CUT_PERCENT, LOSS_CONSOLATION, LOSS_CONSOLATION_DAILY_CAP } from '../../config/economy.js';
import { drawRefund, rescueAmount, settleDuel, winnerPayout } from '../duel.js';
import type { DuelRules } from '../duel.js';

const rules: DuelRules = { entryFee: ENTRY_FEE_BASE, houseCutPercent: HOUSE_CUT_PERCENT, freePerDay: DAILY_FREE_MATCHES, freePayoutPercent: FREE_MATCH_PAYOUT_PERCENT, consolation: LOSS_CONSOLATION, consolationCap: LOSS_CONSOLATION_DAILY_CAP, rescueTarget: BROKE_RESCUE_TARGET };

describe('duel settlement', () => {
  it('pays the pot minus the house cut to the winner and a small consolation to the loser', () => {
    expect(winnerPayout(rules)).toBe(36);
    expect(settleDuel(rules, ['paid', 'paid'], 0, 'solved', [10, 10])).toEqual([{ kind: 'payout', coins: 36 }, { kind: 'consolation', coins: 5 }]);
  });
  it('pays a free-match win a share and a bot win nothing', () => {
    expect(settleDuel(rules, ['free', 'paid'], 0, 'solved', [10, 0])[0]).toEqual({ kind: 'payout', coins: 18 });
    expect(settleDuel(rules, ['house', 'paid'], 0, 'solved', [10, 10])[0]).toBeNull();
  });
  it('refunds paid fees minus the cut on a draw, nothing for free or bot seats', () => {
    expect(drawRefund(rules)).toBe(18);
    expect(settleDuel(rules, ['paid', 'free'], null, 'solved', [10, 10])).toEqual([{ kind: 'refund', coins: 18 }, null]);
  });
  it('gives no consolation to someone who abandoned, to a bot, or over the daily cap', () => {
    expect(settleDuel(rules, ['paid', 'paid'], 0, 'abandon', [10, 10])[1]).toBeNull();
    expect(settleDuel(rules, ['paid', 'house'], 0, 'solved', [10, 10])[1]).toBeNull();
    expect(settleDuel(rules, ['paid', 'paid'], 0, 'solved', [10, 0])[1]).toBeNull();
    expect(settleDuel(rules, ['paid', 'paid'], 0, 'solved', [10, 3])[1]).toEqual({ kind: 'consolation', coins: 3 });
  });
  it('tops a broke player up to the rescue target', () => {
    expect(rescueAmount(5, rules)).toBe(55);
    expect(rescueAmount(20, rules)).toBe(0);
  });
});
