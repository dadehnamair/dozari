import { isProfileTaskKey, nextProfileTask } from '@dozari/shared';
import type { ProfileTask, ProfileTaskKey } from '@dozari/shared';

/** What tapping the nudge does: take the reward, or open the place where the field is filled in. */
export type NudgeAction = 'claim' | 'profile' | 'settings' | 'bale';

export interface Nudge {
  task: ProfileTask;
  /** The task's key, narrowed to the profile steps (only those are nudged; D163 missions live on their own screen). */
  key: ProfileTaskKey;
  action: NudgeAction;
}

const OPENS: Record<ProfileTaskKey, Exclude<NudgeAction, 'claim'>> = { gender: 'profile', city: 'profile', phone: 'settings', bale: 'bale' };

/** The next profile step to point Home's guide at; `available` hides steps whose screen is switched off. */
export function profileNudge(tasks: readonly ProfileTask[], available: (key: ProfileTaskKey) => boolean): Nudge | null {
  const task = nextProfileTask(tasks.filter((t) => isProfileTaskKey(t.key) && available(t.key)));
  if (!task || !isProfileTaskKey(task.key)) return null;
  return { task, key: task.key, action: task.done ? 'claim' : OPENS[task.key] };
}
