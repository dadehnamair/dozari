import { session } from '../auth';
import { callJson } from '../net/http';

/** Deletes the account on the server, then forgets it on this device (the next launch starts a fresh guest). */
export async function deleteMyAccount(): Promise<void> {
  await session.authed((token) => callJson('/me', 'DELETE', undefined, token));
  await session.forget();
}

export const signOutEverywhere = (): Promise<void> => session.authed(async (token) => void (await callJson('/me/sign-out-everywhere', 'POST', {}, token))).then(() => session.forget());
