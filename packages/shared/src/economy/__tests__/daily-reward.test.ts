import { describe, expect, it } from 'vitest';
import { DEFAULT_DAILY_REWARD_STEPS, MAX_DAILY_REWARD_COINS, MAX_DAILY_REWARD_DAYS } from '../../config/index.js';
import { afterClaim, coinsForDay, nextDailyReward, validDailySteps } from '../daily-reward.js';
import type { DailyRewardState } from '../daily-reward.js';

const H = 60 * 60 * 1000;
const T0 = 1_700_000_000_000;
const steps = DEFAULT_DAILY_REWARD_STEPS;
const claimed = (day: number, at = T0): DailyRewardState => afterClaim(day, at);

describe('nextDailyReward', () => {
  it('the first ever claim is day 1 = 10 coins', () => {
    expect(nextDailyReward({ lastClaimedAt: null, streakDay: 0 }, steps, T0)).toEqual({ status: 'ready', day: 1, coins: 10 });
  });

  it('pays 10, 15, 20 on consecutive days', () => {
    let state: DailyRewardState = { lastClaimedAt: null, streakDay: 0 };
    const paid: number[] = [];
    let now = T0;
    for (let i = 0; i < 3; i++) {
      const d = nextDailyReward(state, steps, now);
      if (d.status !== 'ready') throw new Error('expected ready');
      paid.push(d.coins);
      state = afterClaim(d.day, now);
      now += 24 * H + 5 * 60 * 1000; // a day and a bit later
    }
    expect(paid).toEqual([10, 15, 20]);
  });

  it('cannot be claimed again within 24 hours, and says when it can', () => {
    const state = claimed(1);
    expect(nextDailyReward(state, steps, T0 + 1)).toEqual({ status: 'wait', availableAt: T0 + 24 * H });
    expect(nextDailyReward(state, steps, T0 + 24 * H - 1)).toEqual({ status: 'wait', availableAt: T0 + 24 * H });
    expect(nextDailyReward(state, steps, T0 + 24 * H)).toMatchObject({ status: 'ready', day: 2 });
  });

  it('continues the streak up to 48 hours, then starts over at day 1', () => {
    const state = claimed(2);
    expect(nextDailyReward(state, steps, T0 + 47 * H)).toEqual({ status: 'ready', day: 3, coins: 20 });
    expect(nextDailyReward(state, steps, T0 + 48 * H)).toEqual({ status: 'ready', day: 1, coins: 10 });
    expect(nextDailyReward(state, steps, T0 + 10 * 24 * H)).toEqual({ status: 'ready', day: 1, coins: 10 });
  });

  it('keeps paying the last step once the streak passes the configured days', () => {
    expect(nextDailyReward(claimed(3), steps, T0 + 25 * H)).toEqual({ status: 'ready', day: 4, coins: 20 });
    expect(nextDailyReward(claimed(40), steps, T0 + 25 * H)).toEqual({ status: 'ready', day: 41, coins: 20 });
  });

  it('follows whatever steps the admin configured', () => {
    expect(nextDailyReward(claimed(1), [5, 50, 500], T0 + 30 * H)).toEqual({ status: 'ready', day: 2, coins: 50 });
  });

  it('is disabled with no steps, and waits if the clock went backwards', () => {
    expect(nextDailyReward({ lastClaimedAt: null, streakDay: 0 }, [], T0)).toEqual({ status: 'disabled' });
    expect(nextDailyReward(claimed(1, T0 + 5 * H), steps, T0)).toMatchObject({ status: 'wait' });
  });
});

describe('coinsForDay / validDailySteps', () => {
  it('clamps days to the list', () => {
    expect([1, 2, 3, 4, 0, -2].map((d) => coinsForDay(steps, d))).toEqual([10, 15, 20, 20, 10, 10]);
  });

  it('accepts only 1..max whole, positive amounts', () => {
    const ok = (s: number[]) => validDailySteps(s, MAX_DAILY_REWARD_DAYS, MAX_DAILY_REWARD_COINS);
    expect(ok([10, 15, 20])).toBe(true);
    expect(ok([])).toBe(false);
    expect(ok([0])).toBe(false);
    expect(ok([1.5])).toBe(false);
    expect(ok([-5])).toBe(false);
    expect(ok([MAX_DAILY_REWARD_COINS + 1])).toBe(false);
    expect(ok(Array(MAX_DAILY_REWARD_DAYS + 1).fill(10))).toBe(false);
  });
});
