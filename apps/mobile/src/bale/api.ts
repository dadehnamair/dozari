import { baleLinkCodeSchema, baleLinkStatusSchema } from '@dozari/shared';
import type { BaleLinkCode, BaleLinkStatus } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

export const fetchBaleLink = (): Promise<BaleLinkStatus> =>
  session.authed(async (token) => baleLinkStatusSchema.parse(await callJson('/bale/link', 'GET', undefined, token)));

export const requestBaleCode = (): Promise<BaleLinkCode> =>
  session.authed(async (token) => baleLinkCodeSchema.parse(await callJson('/bale/link-code', 'POST', undefined, token)));

export const unlinkBale = (): Promise<void> =>
  session.authed(async (token) => {
    await callJson('/bale/link', 'DELETE', undefined, token);
  });
