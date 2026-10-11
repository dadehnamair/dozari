import { adCompleteOkSchema, adsStatusSchema, adStartOkSchema } from '@dozari/shared';
import type { AdCompleteError, AdPlacement, AdsStatus } from '@dozari/shared';
import { session } from '../auth';
import { ApiError, callJson } from '../net/http';

/** Adult players on a server with ads switched on get offers; anything else (kid/teen 403, off, offline) reads as no offers. */
export const fetchAds = async (): Promise<AdsStatus> => {
  try {
    return await session.authed(async (token) => adsStatusSchema.parse(await callJson('/ads', 'GET', undefined, token)));
  } catch {
    return { enabled: false, offers: [] };
  }
};

export type StartOutcome = { ok: true; viewId: string; minWatchSeconds: number } | { ok: false; error: 'disabled' | 'capped' | 'cooldown' | 'network' };

export const startAd = (placement: AdPlacement): Promise<StartOutcome> =>
  session.authed(async (token) => {
    try {
      return { ok: true as const, ...adStartOkSchema.parse(await callJson('/ads/start', 'POST', { placement }, token)) };
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) return { ok: false as const, error: err.code === 'capped' ? ('capped' as const) : ('cooldown' as const) };
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) return { ok: false as const, error: 'disabled' as const };
      return { ok: false as const, error: 'network' as const };
    }
  });

export type CompleteOutcome = { ok: true; rewardKind: string; rewardAmount: number; balance: number; gems: number } | { ok: false; error: AdCompleteError | 'network' };

export const completeAd = (viewId: string, proof?: string): Promise<CompleteOutcome> =>
  session.authed(async (token) => {
    try {
      return adCompleteOkSchema.parse(await callJson('/ads/complete', 'POST', { viewId, proof }, token));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 409)) {
        const code = err.code;
        return { ok: false as const, error: (['not_found', 'already', 'too_early', 'expired'].includes(code) ? code : 'not_found') as AdCompleteError };
      }
      return { ok: false as const, error: 'network' as const };
    }
  });
