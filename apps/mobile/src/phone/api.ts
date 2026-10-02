import { phoneStatusSchema } from '@dozari/shared';
import type { PhoneStatus } from '@dozari/shared';
import { session } from '../auth';
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
