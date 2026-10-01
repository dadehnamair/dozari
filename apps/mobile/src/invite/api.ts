import { myInviteSchema, redeemResultSchema } from '@dozari/shared';
import type { MyInvite, RedeemResult } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

export const fetchInvite = (): Promise<MyInvite> => session.authed(async (token) => myInviteSchema.parse(await callJson('/me/invite', 'GET', undefined, token)));
export const redeemInvite = (code: string): Promise<RedeemResult> =>
  session.authed(async (token) => redeemResultSchema.parse(await callJson('/invite/redeem', 'POST', { code }, token)));
