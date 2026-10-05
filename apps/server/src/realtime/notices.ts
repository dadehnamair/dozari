import type { LiveNotice } from '@dozari/shared';

/**
 * Tiny «you have something new» pushes over the live socket (a friend request, an inbox message). Nothing is stored or
 * queued: a player who is offline simply sees it the next time the app loads that list. The gateway fills in `push`.
 */
export interface LiveNotices {
  push: (userId: string, notice: LiveNotice) => void;
}

export const createLiveNotices = (): LiveNotices => ({ push: () => undefined });
