import { describe, expect, it } from 'vitest';
import { dailyRewardClaimSchema, dailyRewardStatusSchema } from '../contract.js';

describe('daily reward wire contract', () => {
  it('parses the card the server sends', () => {
    const card = { canClaim: true, day: 1, coins: 10, nextClaimAt: null, steps: [10, 15, 20], balance: 0 };
    expect(dailyRewardStatusSchema.parse(card)).toEqual(card);
    expect(() => dailyRewardStatusSchema.parse({ ...card, steps: [] })).not.toThrow();
    expect(() => dailyRewardStatusSchema.parse({ ...card, day: 0 })).toThrow();
  });

  it('parses a successful claim', () => {
    const claim = { ok: true, day: 2, coins: 15, balance: 25, nextClaimAt: 1_700_000_000_000 };
    expect(dailyRewardClaimSchema.parse(claim)).toEqual(claim);
    expect(() => dailyRewardClaimSchema.parse({ ...claim, ok: false })).toThrow();
  });
});
