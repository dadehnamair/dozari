import { isProfileTaskKey } from '@dozari/shared';
import type { MissionKey, ProfileTask } from '@dozari/shared';

/** Where a mission sends the player: a link outside the app, or a place inside it. */
export type MissionGo = 'link' | 'profile' | 'settings' | 'bale' | 'play' | 'invite';

export const GO: Record<MissionKey, MissionGo> = {
  gender: 'profile',
  city: 'profile',
  phone: 'settings',
  bale: 'bale',
  first_win: 'play',
  invite_friend: 'invite',
  follow_instagram: 'link',
  follow_channel: 'link',
  rate_app: 'link',
};

export type MissionState = 'claimed' | 'claim' | 'go';

export interface MissionRow {
  task: ProfileTask;
  state: MissionState;
  go: MissionGo;
}

export interface MissionAvailability {
  /** The link of an outside mission; an empty one hides the mission. */
  link(key: MissionKey): string | null;
  /** Is the screen of an in-app mission switched on (Bale, settings)? */
  feature(key: MissionKey): boolean;
}

/**
 * The missions list: hidden when its link or screen is unavailable or it pays nothing, finished ones last.
 * An honour mission (a link) is only claimable after the player has opened its link (`visited`); the others when the server says done.
 */
export function missionRows(tasks: readonly ProfileTask[], avail: MissionAvailability, visited: ReadonlySet<MissionKey>): MissionRow[] {
  const rows: MissionRow[] = [];
  for (const task of tasks) {
    const go = GO[task.key];
    if (task.coins <= 0 && !task.claimed) continue;
    if (go === 'link' && !task.claimed && !avail.link(task.key)) continue;
    if (!isProfileTaskKey(task.key) ? false : !avail.feature(task.key)) continue;
    const ready = go === 'link' ? visited.has(task.key) && task.done : task.done;
    rows.push({ task, go, state: task.claimed ? 'claimed' : ready ? 'claim' : 'go' });
  }
  const rank = { claim: 0, go: 1, claimed: 2 } as const;
  return rows.sort((a, b) => rank[a.state] - rank[b.state]);
}
