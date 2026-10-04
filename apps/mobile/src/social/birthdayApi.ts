import { birthdayClaimSchema, myBirthdaySchema } from '@dozari/shared';
import type { BirthdayClaim, BirthdayPut, MyBirthday } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

const authed = <T>(path: string, method: 'GET' | 'POST' | 'PUT', parse: (v: unknown) => T, body?: unknown): Promise<T> =>
  session.authed(async (token) => parse(await callJson(path, method, body, token)));

export const fetchBirthday = (): Promise<MyBirthday> => authed('/me/birthday', 'GET', (v) => myBirthdaySchema.parse(v));
export const saveBirthday = (b: BirthdayPut): Promise<MyBirthday> => authed('/me/birthday', 'PUT', (v) => myBirthdaySchema.parse(v), b);
export const claimBirthdayGift = (): Promise<BirthdayClaim> => authed('/me/birthday/claim', 'POST', (v) => birthdayClaimSchema.parse(v));
