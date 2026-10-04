import { gemWalletSchema } from '@dozari/shared';
import type { GemWallet } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

export const fetchGems = (): Promise<GemWallet> => session.authed(async (token) => gemWalletSchema.parse(await callJson('/me/gems', 'GET', undefined, token)));
