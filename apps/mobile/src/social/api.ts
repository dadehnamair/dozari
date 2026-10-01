import { friendsSchema, myProfileSchema, playerProfileSchema } from '@dozari/shared';
import type { Friends, Gender, MyProfile, PlayerProfile } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

const authed = <T>(path: string, method: 'GET' | 'POST' | 'DELETE' | 'PUT', parse: (v: unknown) => T, body?: unknown): Promise<T> =>
  session.authed(async (token) => parse(await callJson(path, method, body, token)));

export const fetchMyProfile = (): Promise<MyProfile> => authed('/me/profile', 'GET', (v) => myProfileSchema.parse(v));
export const saveGender = (gender: Gender | null): Promise<void> => authed('/me/gender', 'PUT', () => undefined, { gender });
export const fetchPlayer = (id: string): Promise<PlayerProfile> => authed(`/players/${id}`, 'GET', (v) => playerProfileSchema.parse(v));
export const fetchFriends = (): Promise<Friends> => authed('/friends', 'GET', (v) => friendsSchema.parse(v));
export const requestFriend = (id: string): Promise<void> => authed(`/friends/${id}/request`, 'POST', () => undefined);
export const acceptFriend = (id: string): Promise<void> => authed(`/friends/${id}/accept`, 'POST', () => undefined);
export const removeFriend = (id: string): Promise<void> => authed(`/friends/${id}`, 'DELETE', () => undefined);
