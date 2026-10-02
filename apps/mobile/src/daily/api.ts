import { dailyRewardClaimSchema, dailyRewardStatusSchema } from '@dozari/shared';
import type { DailyRewardClaim, DailyRewardStatus } from '@dozari/shared';
import { session } from '../auth';
import { ApiError, callJson } from '../net/http';

export const fetchDailyReward = (): Promise<DailyRewardStatus> =>
  session.authed(async (token) => dailyRewardStatusSchema.parse(await callJson('/daily-reward', 'GET', undefined, token)));

/** `TOO_EARLY` (409) means someone else (another device, a double tap) claimed first: the caller reloads the card. */
export const claimDailyReward = (): Promise<DailyRewardClaim | 'too_early'> =>
  session.authed(async (token) => {
    try {
      return dailyRewardClaimSchema.parse(await callJson('/daily-reward/claim', 'POST', undefined, token));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) return 'too_early' as const;
      throw err;
    }
  });
