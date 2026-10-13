import type { LiveNotice } from '@dozari/shared';

/**
 * Tiny «you have something new» pushes over the live socket (a friend request, an inbox message). Nothing is stored or
 * queued: a player who is offline simply sees it the next time the app loads that list. The gateway fills in `push`.
 */
export interface LiveNotices {
  push: (userId: string, notice: LiveNotice) => void;
  /** Set at start-up: also called for every notice, online or not (the browser push for players who are not looking at the app). The gateway's `push` must call it. */
  also?: (userId: string, notice: LiveNotice) => void;
}

export const createLiveNotices = (): LiveNotices => {
  const n: LiveNotices = { push: (userId, notice) => n.also?.(userId, notice) };
  return n;
};
