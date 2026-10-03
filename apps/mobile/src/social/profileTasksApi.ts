import { profileTaskClaimSchema, profileTasksSchema } from '@dozari/shared';
import type { MissionKey, ProfileTaskClaim, ProfileTasks } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

export const fetchProfileTasks = (): Promise<ProfileTasks> => session.authed(async (token) => profileTasksSchema.parse(await callJson('/me/profile-tasks', 'GET', undefined, token)));

/** Takes the one-time reward of a finished profile step; the server checks the field is really filled in. */
export const claimProfileTask = (key: MissionKey): Promise<ProfileTaskClaim> => session.authed(async (token) => profileTaskClaimSchema.parse(await callJson(`/me/profile-tasks/${key}/claim`, 'POST', undefined, token)));
