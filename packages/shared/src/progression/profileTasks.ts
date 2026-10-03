import { z } from 'zod';

/** Profile steps that pay a one-time coin reward (D161). Nickname and avatar are always set at signup, so they are not steps. */
export const PROFILE_TASK_KEYS = ['gender', 'city', 'phone', 'bale'] as const;
export type ProfileTaskKey = (typeof PROFILE_TASK_KEYS)[number];
export const profileTaskKeySchema = z.enum(PROFILE_TASK_KEYS);

export const profileTaskSchema = z.object({
  key: profileTaskKeySchema,
  /** The profile already has this field filled in (checked on the server). */
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
export const profileTaskClaimSchema = z.object({ ok: z.literal(true), key: profileTaskKeySchema, coins: z.number().int().nonnegative(), balance: z.number().int().nonnegative() });
export type ProfileTaskClaim = z.infer<typeof profileTaskClaimSchema>;

/**
 * The step Home should point at: a finished step whose reward is waiting first, else the first unfinished one.
 * Steps worth 0 coins are never nudged. Null when nothing is left.
 */
export function nextProfileTask(tasks: readonly ProfileTask[]): ProfileTask | null {
  const live = tasks.filter((t) => t.coins > 0 && !t.claimed);
  return live.find((t) => t.done) ?? live[0] ?? null;
}
