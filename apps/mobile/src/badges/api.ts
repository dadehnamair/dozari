import { myBadgesSchema } from '@dozari/shared';
import type { MyBadges } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

export const fetchMyBadges = (): Promise<MyBadges> => session.authed(async (token) => myBadgesSchema.parse(await callJson('/me/badges', 'GET', undefined, token)));
export const equipBadge = (badgeId: string | null): Promise<void> =>
  session.authed(async (token) => {
    await callJson('/me/badge', 'PUT', { badgeId }, token);
  });
export const markNoticesRead = (): Promise<void> =>
  session.authed(async (token) => {
    await callJson('/me/notices/read', 'POST', undefined, token);
  });
