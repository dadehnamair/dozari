import { z } from 'zod';

/** Profile steps that pay a one-time coin reward (D161). Nickname and avatar are always set at signup, so they are not steps. */
export const PROFILE_TASK_KEYS = ['gender', 'city', 'phone', 'bale'] as const;
export type ProfileTaskKey = (typeof PROFILE_TASK_KEYS)[number];

/**
 * Other one-time missions (D163). `first_win` and `invite_friend` are checked on the server; the other three cannot be
 * verified (a follow or a store review happens outside the app), so they are honour claims with a small reward.
 */
export const OTHER_MISSION_KEYS = ['first_win', 'invite_friend', 'follow_instagram', 'follow_channel', 'rate_app'] as const;
export const MISSION_KEYS = [...PROFILE_TASK_KEYS, ...OTHER_MISSION_KEYS] as const;
export type MissionKey = (typeof MISSION_KEYS)[number];
export const missionKeySchema = z.enum(MISSION_KEYS);
export const profileTaskKeySchema = missionKeySchema;
export const isProfileTaskKey = (key: string): key is ProfileTaskKey => (PROFILE_TASK_KEYS as readonly string[]).includes(key);

export const profileTaskSchema = z.object({
  key: missionKeySchema,
  /** The mission is already has this field filled in (checked on the server). */
  done: z.boolean(),
  /** The reward was already taken. */
  claimed: z.boolean(),
  coins: z.number().int().nonnegative(),
});
export type ProfileTask = z.infer<typeof profileTaskSchema>;

/** `GET /me/profile-tasks`. */
export const profileTasksSchema = z.object({ tasks: z.array(profileTaskSchema) });
export type ProfileTasks = z.infer<typeof profileTasksSchema>;

/** `POST /me/profile-tasks/:key/claim`. */
export const profileTaskClaimSchema = z.object({ ok: z.literal(true), key: missionKeySchema, coins: z.number().int().nonnegative(), balance: z.number().int().nonnegative() });
export type ProfileTaskClaim = z.infer<typeof profileTaskClaimSchema>;

/**
 * The step Home should point at: a finished step whose reward is waiting first, else the first unfinished one.
 * Steps worth 0 coins are never nudged. Null when nothing is left.
 */
export function nextProfileTask(tasks: readonly ProfileTask[]): ProfileTask | null {
  const live = tasks.filter((t) => isProfileTaskKey(t.key) && t.coins > 0 && !t.claimed);
  return live.find((t) => t.done) ?? live[0] ?? null;
}
