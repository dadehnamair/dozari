import { citiesSchema, friendsSchema, leaderboardSchema, myFindSchema, myProfileSchema, playerProfileSchema, searchResultSchema } from '@dozari/shared';
import type { City, Friends, FoundPlayer, Gender, Leaderboard, LeaderboardPeriod, LeaderboardScope, MyFind, MyProfile, PlayerProfile } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

const authed = <T>(path: string, method: 'GET' | 'POST' | 'DELETE' | 'PUT', parse: (v: unknown) => T, body?: unknown): Promise<T> =>
  session.authed(async (token) => parse(await callJson(path, method, body, token)));

export const fetchLeaderboard = (scope: LeaderboardScope, period: LeaderboardPeriod = 'all'): Promise<Leaderboard> => authed(`/leaderboard?scope=${scope}&period=${period}`, 'GET', (v) => leaderboardSchema.parse(v));
export const fetchMyProfile = (): Promise<MyProfile> => authed('/me/profile', 'GET', (v) => myProfileSchema.parse(v));
export const saveGender = (gender: Gender | null): Promise<void> => authed('/me/gender', 'PUT', () => undefined, { gender });
export const fetchPlayer = (id: string): Promise<PlayerProfile> => authed(`/players/${id}`, 'GET', (v) => playerProfileSchema.parse(v));
export const fetchFriends = (): Promise<Friends> => authed('/friends', 'GET', (v) => friendsSchema.parse(v));
export const requestFriend = (id: string): Promise<void> => authed(`/friends/${id}/request`, 'POST', () => undefined);
export const acceptFriend = (id: string): Promise<void> => authed(`/friends/${id}/accept`, 'POST', () => undefined);
export const removeFriend = (id: string): Promise<void> => authed(`/friends/${id}`, 'DELETE', () => undefined);
export const fetchCities = (): Promise<City[]> => authed('/cities', 'GET', (v) => citiesSchema.parse(v).cities);
export const saveCity = (cityId: string | null): Promise<void> => authed('/me/city', 'PUT', () => undefined, { cityId });
export const saveEmail = (email: string | null): Promise<void> => authed('/me/email', 'PUT', () => undefined, { email });
export const saveNickname = (nickname: string): Promise<string> => authed('/me/nickname', 'PUT', (v) => String((v as { nickname: unknown }).nickname), { nickname });
export const fetchMyFind = (): Promise<MyFind> => authed('/me/find', 'GET', (v) => myFindSchema.parse(v));
export const saveFindable = (findableByPhone: boolean): Promise<MyFind> => authed('/me/find', 'PUT', (v) => myFindSchema.parse(v), { findableByPhone });
export const searchPlayer = (q: string): Promise<FoundPlayer | null> => authed(`/players/search?q=${encodeURIComponent(q)}`, 'GET', (v) => searchResultSchema.parse(v).player);
export const friendByLink = (handle: string): Promise<{ status: string }> => authed('/friends/link', 'POST', (v) => v as { status: string }, { handle });
