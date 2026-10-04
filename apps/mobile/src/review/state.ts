import { deviceStore } from '../auth/storage';
import { decodeState, encodeState } from './logic';
import type { ReviewState } from './logic';

const KEY = 'dozari.review.v1';

export async function loadReviewState(now = Date.now()): Promise<ReviewState> {
  const state = decodeState(await deviceStore.get(KEY), now);
  await deviceStore.set(KEY, encodeState(state)); // first open is remembered from the very first launch
  return state;
}

export async function updateReviewState(change: (s: ReviewState) => ReviewState): Promise<ReviewState> {
  const next = change(await loadReviewState());
  await deviceStore.set(KEY, encodeState(next));
  return next;
}

/** Called when a game ends; counts toward `review.after_games`. */
export const recordGameFinished = (): Promise<ReviewState> => updateReviewState((s) => ({ ...s, gamesFinished: s.gamesFinished + 1 }));
