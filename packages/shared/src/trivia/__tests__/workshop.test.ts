import { describe, expect, it } from 'vitest';
import { authorReward, blindOrder, isNearDuplicate, milestonesCrossed, normalizeFa, reviewAgreed, reviewSettlePoints, reviewerTitle, textSimilarity, workshopAutoState, workshopReviewScore, workshopSubmitSchema } from '../workshop.js';

const rules = { coins: 40, firstBonus: 40, milestoneEvery: 5, milestoneBonus: 50, thinBonus: 15, boostPercent: 0 };

describe('author reward', () => {
  it('base only, then first, milestone, thin and boost stack', () => {
    expect(authorReward(2, false, rules)).toMatchObject({ base: 40, first: 0, milestone: 0, thin: 0, boost: 0, total: 40 });
    expect(authorReward(1, false, rules).total).toBe(80);
    expect(authorReward(5, false, rules).total).toBe(90);
    expect(authorReward(10, true, rules).total).toBe(40 + 50 + 15);
    expect(authorReward(1, true, rules).total).toBe(40 + 40 + 15);
  });
  it('a campaign multiplies the whole reward', () => {
    const r = authorReward(1, true, { ...rules, boostPercent: 100 });
    expect(r).toMatchObject({ total: 190, boost: 95 });
  });
  it('turns off cleanly: zero coins, no milestone when every is 0', () => {
    expect(authorReward(5, false, { ...rules, coins: 0, firstBonus: 0, milestoneEvery: 0 }).total).toBe(0);
  });
});

describe('review scoring', () => {
  it('scores a review −2…+2', () => {
    expect(workshopReviewScore(true, 1)).toBe(2);
    expect(workshopReviewScore(true, -1)).toBe(0);
    expect(workshopReviewScore(false, 1)).toBe(0);
    expect(workshopReviewScore(false, -1)).toBe(-2);
  });
  it('moves to the admin queue only with enough score AND reviewers, and rejects on a low score', () => {
    const r = { approveScore: 6, rejectScore: 5, minReviewers: 3 };
    expect(workshopAutoState(6, 2, r)).toBe('pending');
    expect(workshopAutoState(6, 3, r)).toBe('ready_for_review');
    expect(workshopAutoState(-5, 3, r)).toBe('rejected');
    expect(workshopAutoState(-4, 5, r)).toBe('pending');
  });
  it('a settled review is worth the base point plus the bonus only when the pick and the thumb matched the outcome', () => {
    expect(reviewAgreed(true, 1, 'approved')).toBe(true);
    expect(reviewAgreed(true, -1, 'approved')).toBe(false);
    expect(reviewAgreed(true, -1, 'rejected')).toBe(true);
    expect(reviewAgreed(false, 1, 'approved')).toBe(false);
    expect(reviewSettlePoints(1, true, 3)).toBe(4);
    expect(reviewSettlePoints(1, false, 3)).toBe(1);
  });
});

describe('milestones and titles', () => {
  it('lists every coin milestone crossed', () => {
    expect(milestonesCrossed(28, 31, 30)).toEqual([1]);
    expect(milestonesCrossed(29, 95, 30)).toEqual([1, 2, 3]);
    expect(milestonesCrossed(31, 59, 30)).toEqual([]);
    expect(milestonesCrossed(0, 100, 0)).toEqual([]);
  });
  it('maps points to a title and tells the next threshold', () => {
    expect(reviewerTitle(0)).toEqual({ index: 0, nextAt: 30 });
    expect(reviewerTitle(120)).toEqual({ index: 2, nextAt: 400 });
    expect(reviewerTitle(5000)).toEqual({ index: 4, nextAt: null });
  });
});

describe('duplicates and blind order', () => {
  it('normalises Persian text and finds near duplicates', () => {
    expect(normalizeFa('پفک ‌نمکی؟')).toBe(normalizeFa('پفک نمکي'));
    expect(textSimilarity('پایتخت ایران کدام شهر است', 'پایتخت ایران کدام شهر است؟')).toBe(1);
    expect(isNearDuplicate('پایتخت ایران کدام شهر است؟', ['پایتخت ایران کدام شهر است'])).toBe(true);
    expect(isNearDuplicate('بزرگ‌ترین دریاچه‌ی ایران کدام است؟', ['پایتخت ایران کدام شهر است'])).toBe(false);
  });
  it('shuffles the choices per reviewer, stably', () => {
    expect(blindOrder('r1', 's1')).toEqual(blindOrder('r1', 's1'));
    expect([...blindOrder('r1', 's1')].sort()).toEqual([0, 1, 2, 3]);
    const orders = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((r) => blindOrder(r, 's1').join('')));
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe('submit schema', () => {
  const ok = { topicId: '00000000-0000-7000-d000-000000000001', textFa: 'پایتخت ایران کدام شهر است؟', options: ['تهران', 'شیراز', 'اصفهان', 'تبریز'], correctIndex: 0, explanationFa: '', difficulty: 1 };
  it('accepts a good question and rejects equal choices after normalisation', () => {
    expect(workshopSubmitSchema.safeParse(ok).success).toBe(true);
    expect(workshopSubmitSchema.safeParse({ ...ok, options: ['تهران', 'تهران ', 'اصفهان', 'تبریز'] }).success).toBe(false);
    expect(workshopSubmitSchema.safeParse({ ...ok, correctIndex: 4 }).success).toBe(false);
  });
});
