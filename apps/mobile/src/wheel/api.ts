import { wheelSpinSchema, wheelStatusSchema } from '@dozari/shared';
import type { WheelSpin, WheelStatus } from '@dozari/shared';
import { session } from '../auth';
import { ApiError, callJson } from '../net/http';

export const fetchWheel = (): Promise<WheelStatus> =>
  session.authed(async (token) => wheelStatusSchema.parse(await callJson('/wheel', 'GET', undefined, token)));

/** Null when no spin is waiting any more (409: another device or a double tap used it). */
export const spinWheel = (): Promise<WheelSpin | null> =>
  session.authed(async (token) => {
    try {
      return wheelSpinSchema.parse(await callJson('/wheel/spin', 'POST', undefined, token));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) return null;
      throw err;
    }
  });
