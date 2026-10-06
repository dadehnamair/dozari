import type { SoloView } from '@dozari/shared';
import { session } from '../auth';
import { startDailySolo, startSolo } from './api';
import { ApiError } from '../net/http';

/** Starts a game as the signed-in guest, so a finished game counts toward level and hints can be paid for; falls back to anonymous play if sign-in fails. */
export async function beginSolo(previewTrack?: 'kid' | 'teen'): Promise<SoloView> {
  try {
    return await session.authed((token) => startSolo(token, previewTrack));
  } catch (err) {
    if (err instanceof ApiError || previewTrack) throw err; // a preview needs the guardian's own sign-in; it never falls back to anonymous play
    return startSolo();
  }
}

/** Today's daily puzzle: needs a signed-in player (one attempt per account and day). */
export function beginDaily(): Promise<SoloView> {
  return session.authed((token) => startDailySolo(token));
}
