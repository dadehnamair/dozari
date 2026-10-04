import { session } from '../auth';
import { callJson } from '../net/http';

/** Asks the server to send the one-time code that guards deleting the account (SMS or Bale). */
export const requestDeleteCode = (): Promise<{ channel: 'sms' | 'bale' }> =>
  session.authed(async (token) => (await callJson('/me/delete/code', 'POST', {}, token)) as { channel: 'sms' | 'bale' });

/** Deletes the account with the one-time code, then forgets it on this device (the next launch starts a fresh guest). */
export async function deleteMyAccount(code: string): Promise<void> {
  await session.authed((token) => callJson('/me', 'DELETE', { code }, token));
  await session.forget();
}

export const signOutEverywhere = (): Promise<void> => session.authed(async (token) => void (await callJson('/me/sign-out-everywhere', 'POST', {}, token))).then(() => session.forget());
