import { phoneResolveSchema, phoneStatusSchema } from '@dozari/shared';
import type { PhoneChoice, PhoneStatus } from '@dozari/shared';
import { session } from '../auth';
import { announceAccountSwitched } from '../auth/switched';
import { callJson } from '../net/http';

const status = (path: string, method: 'GET' | 'PUT' | 'POST' | 'DELETE', body?: unknown): Promise<PhoneStatus> =>
  session.authed(async (token) => phoneStatusSchema.parse(await callJson(path, method, body, token)));

export const fetchPhone = (): Promise<PhoneStatus> => status('/me/phone', 'GET');
export const savePhone = (phone: string): Promise<PhoneStatus> => status('/me/phone', 'PUT', { phone });
export const verifySmsCode = (code: string): Promise<PhoneStatus> => status('/me/phone/verify', 'POST', { code });
export const requestSms = (): Promise<void> =>
  session.authed(async (token) => {
    await callJson('/me/phone/sms', 'POST', undefined, token);
  });

/**
 * The player's answer when the proven number already belongs to another account. `keep_current` returns the new status;
 * `load_previous` switches this device to the old account (token swapped, the whole app starts over) and returns null.
 */
export async function resolvePhone(choice: PhoneChoice): Promise<PhoneStatus | null> {
  const deviceId = await session.deviceId();
  const out = await session.authed(async (token) => phoneResolveSchema.parse(await callJson('/me/phone/resolve', 'POST', { choice, deviceId }, token)));
  if (out.session) {
    await session.adopt(out.session.token);
    announceAccountSwitched();
    return null;
  }
  return out.status;
}
