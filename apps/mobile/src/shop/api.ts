import { shopSchema, soloHintResultSchema, soloHintsSchema } from '@dozari/shared';
import type { HintKind, Shop, SoloHintResult, SoloHints } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

const authed = <T>(path: string, method: 'GET' | 'POST', parse: (v: unknown) => T, body?: unknown): Promise<T> =>
  session.authed(async (token) => parse(await callJson(path, method, body, token)));

export const fetchShop = (): Promise<Shop> => authed('/shop', 'GET', (v) => shopSchema.parse(v));
export const buyItem = (id: string): Promise<{ balance: number; tokens: number }> =>
  authed(`/shop/${id}/buy`, 'POST', (v) => v as { balance: number; tokens: number });
export const fetchHints = (sessionId: string): Promise<SoloHints> => authed(`/solo/${sessionId}/hints`, 'GET', (v) => soloHintsSchema.parse(v));
export const takeHint = (sessionId: string, kind: HintKind): Promise<SoloHintResult> =>
  authed(`/solo/${sessionId}/hint`, 'POST', (v) => soloHintResultSchema.parse(v), { kind });
