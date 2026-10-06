import { childrenResponseSchema, linkCodeResponseSchema, sessionSchema } from '@dozari/shared';
import type { ChildrenResponse } from '@dozari/shared';
import { session } from '../auth';
import { announceAccountSwitched } from '../auth/switched';
import { callJson } from '../net/http';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
const authed = <T>(parse: (raw: unknown) => T, path: string, method: Method, body?: unknown): Promise<T> => session.authed(async (token) => parse(await callJson(path, method, body, token)));
const ok = (raw: unknown): void => void raw;

/** Child side: ask for an SMS code to the guardian's number, then prove it; the guardian account is found or made by the server. */
export const requestGuardianCode = (phone: string): Promise<void> => authed(ok, '/guardian/request', 'POST', { phone });
export const confirmGuardian = (phone: string, code: string): Promise<void> => authed(ok, '/guardian/confirm', 'POST', { phone, code });

/** Guardian side. */
export const fetchChildren = (): Promise<ChildrenResponse> => authed((r) => childrenResponseSchema.parse(r), '/guardian/children', 'GET');
export const addChild = (track: 'kid' | 'teen'): Promise<void> => authed(ok, '/guardian/children', 'POST', { track });
export const childLinkCode = (childId: string): Promise<{ code: string; expiresInSec: number }> => authed((r) => linkCodeResponseSchema.parse(r), `/guardian/children/${childId}/link-code`, 'POST');
export const setChildTrack = (childId: string, track: 'kid' | 'teen'): Promise<void> => authed(ok, `/guardian/children/${childId}/track`, 'PUT', { track });
export const removeChild = (childId: string): Promise<void> => authed(ok, `/guardian/children/${childId}`, 'DELETE');

/** Right after a phone sign-in: play as one of this number's children instead of the number's own account. */
export async function switchToChild(childId: string): Promise<void> {
  const deviceId = await session.deviceId();
  const out = await authed((r) => sessionSchema.parse(r), `/guardian/children/${childId}/switch`, 'POST', { deviceId });
  await session.adopt(out.token);
}

/** The child's device, signed out: the code the guardian shows signs this device in as the child (the whole app starts over). */
export async function signInWithChildCode(code: string, opts: { announce?: boolean } = {}): Promise<void> {
  const deviceId = await session.deviceId();
  const out = sessionSchema.parse(await callJson('/auth/child-link', 'POST', { code, deviceId }));
  await session.adopt(out.token);
  if (opts.announce !== false) announceAccountSwitched();
}
