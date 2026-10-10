import { childDigestSchema, childrenResponseSchema, guardianSettingsSchema, linkCodeResponseSchema, sessionSchema } from '@dozari/shared';
import type { ChildDigest, ChildrenResponse, GuardianSettings } from '@dozari/shared';
import { session } from '../auth';
import { announceAccountSwitched } from '../auth/switched';
import { callJson } from '../net/http';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
const authed = <T>(parse: (raw: unknown) => T, path: string, method: Method, body?: unknown): Promise<T> => session.authed(async (token) => parse(await callJson(path, method, body, token)));
const ok = (raw: unknown): void => void raw;

/** Child side: ask for an SMS code to the guardian's number, then prove it; the guardian account is found or made by the server. */
export const requestGuardianCode = (phone: string): Promise<void> => authed(ok, '/guardian/request', 'POST', { phone });
export const confirmGuardian = (phone: string, code: string): Promise<void> => authed(ok, '/guardian/confirm', 'POST', { phone, code });

export const fetchMyGuardian = (): Promise<boolean> => authed((r) => (r as { linked?: boolean }).linked === true, '/me/guardian', 'GET');

/** Guardian side. */
export const fetchChildren = (): Promise<ChildrenResponse> => authed((r) => childrenResponseSchema.parse(r), '/guardian/children', 'GET');
export const addChild = (track: 'kid' | 'teen'): Promise<void> => authed(ok, '/guardian/children', 'POST', { track });
export const childLinkCode = (childId: string): Promise<{ code: string; expiresInSec: number }> => authed((r) => linkCodeResponseSchema.parse(r), `/guardian/children/${childId}/link-code`, 'POST');
export const setChildTrack = (childId: string, track: 'kid' | 'teen'): Promise<void> => authed(ok, `/guardian/children/${childId}/track`, 'PUT', { track });
export const removeChild = (childId: string): Promise<void> => authed(ok, `/guardian/children/${childId}`, 'DELETE');
/** Removing a child with games or friends needs a code: does this child need one? */
export const fetchRemoval = (childId: string): Promise<{ needsCode: boolean }> => authed((r) => ({ needsCode: (r as { needsCode?: boolean }).needsCode === true }), `/guardian/children/${childId}/removal`, 'GET');
/** Sends the removal code by SMS to the guardian's own number. */
export const sendRemoveCode = (childId: string): Promise<void> => authed(ok, `/guardian/children/${childId}/remove-code`, 'POST');
export const removeChildWithCode = (childId: string, code: string): Promise<void> => authed(ok, `/guardian/children/${childId}/remove`, 'POST', { code });

/** The child's device, signed out: the code the guardian shows signs this device in as the child (the whole app starts over). */
export async function signInWithChildCode(code: string, opts: { announce?: boolean } = {}): Promise<void> {
  const deviceId = await session.deviceId();
  const out = sessionSchema.parse(await callJson('/auth/child-link', 'POST', { code, deviceId }));
  await session.adopt(out.token);
  if (opts.announce !== false) announceAccountSwitched();
}

/** The guardian panel of one child (docs/logic/age-tracks.md §Guardian panel). */
export const fetchChildSettings = (childId: string): Promise<GuardianSettings> => authed((r) => guardianSettingsSchema.parse(r), `/guardian/children/${childId}/settings`, 'GET');
export const saveChildSettings = (childId: string, settings: GuardianSettings): Promise<GuardianSettings> => authed((r) => guardianSettingsSchema.parse(r), `/guardian/children/${childId}/settings`, 'PUT', settings);
export const fetchChildDigest = (childId: string): Promise<ChildDigest> => authed((r) => childDigestSchema.parse(r), `/guardian/children/${childId}/digest`, 'GET');

export interface ChildFriend {
  id: string;
  nickname: string;
  avatarKey: string;
}
export const fetchChildFriends = (childId: string): Promise<{ friends: ChildFriend[]; requests: ChildFriend[] }> => authed((r) => r as { friends: ChildFriend[]; requests: ChildFriend[] }, `/guardian/children/${childId}/friends`, 'GET');
export const approveChildFriend = (childId: string, otherId: string): Promise<void> => authed(ok, `/guardian/children/${childId}/friends/${otherId}/approve`, 'POST');
export const removeChildFriend = (childId: string, otherId: string): Promise<void> => authed(ok, `/guardian/children/${childId}/friends/${otherId}`, 'DELETE');

export const fetchChildBlocks = (childId: string): Promise<ChildFriend[]> => authed((r) => (r as { blocked: ChildFriend[] }).blocked, `/guardian/children/${childId}/blocks`, 'GET');
export const blockChildFriend = (childId: string, otherId: string): Promise<void> => authed(ok, `/guardian/children/${childId}/blocks/${otherId}`, 'POST');
export const unblockChildFriend = (childId: string, otherId: string): Promise<void> => authed(ok, `/guardian/children/${childId}/blocks/${otherId}`, 'DELETE');
/** The open app reports a minute of play (the guardian's reminder and digest). Errors are ignored: a missed minute is nothing. */
export const sendHeartbeat = (): Promise<void> => authed(ok, '/me/heartbeat', 'POST', {}).catch(() => undefined);
