import { sessionSchema } from '@dozari/shared';
import { session } from '../auth';
import { announceAccountSwitched } from '../auth/switched';
import { callJson } from '../net/http';

/** «ورود با شماره»: ask for an SMS code for a number (no account needed yet). */
export const requestLoginCode = async (phone: string): Promise<void> => {
  await callJson('/auth/phone/code', 'POST', { phone });
};

/** Proves the code: this device switches to the account behind the number (or a new one) and the whole app starts over. */
export async function loginWithCode(phone: string, code: string, opts: { announce?: boolean } = {}): Promise<{ created: boolean }> {
  const deviceId = await session.deviceId();
  const raw = await callJson('/auth/phone/verify', 'POST', { phone, code, deviceId });
  const out = sessionSchema.parse(raw);
  await session.adopt(out.token);
  // From settings the whole app starts over on the new account; the first-run screen just moves on.
  if (opts.announce !== false) announceAccountSwitched();
  return { created: (raw as { created?: unknown }).created === true };
}
