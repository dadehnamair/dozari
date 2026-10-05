import { shopSchema, soloHintResultSchema, soloHintsSchema, soloNudgeResultSchema } from '@dozari/shared';
import type { HintKind, HintPayload, Shop, SoloHintResult, SoloHints } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

const authed = <T>(path: string, method: 'GET' | 'POST', parse: (v: unknown) => T, body?: unknown): Promise<T> =>
  session.authed(async (token) => parse(await callJson(path, method, body, token)));

export const fetchShop = (): Promise<Shop> => authed('/shop', 'GET', (v) => shopSchema.parse(v));
export const buyItem = (id: string): Promise<{ balance: number; gems: number; tokens: number }> =>
  authed(`/shop/${id}/buy`, 'POST', (v) => v as { balance: number; gems: number; tokens: number });
/** Asks the server to send a Bale wallet invoice for a shop item bought with real money (D170). */
export const payWithMoney = (id: string): Promise<void> => authed(`/shop-pay/${id}/bale-invoice`, 'POST', () => undefined);
export const equipItem = (id: string, equipped: boolean): Promise<{ ok: true }> => authed(`/shop/${id}/equip`, 'POST', (v) => v as { ok: true }, { equipped });
export const fetchWorn = (): Promise<{ worn: { id: string; slot: string; iconKey: string | null }[] }> => authed('/me/cosmetics', 'GET', (v) => v as { worn: { id: string; slot: string; iconKey: string | null }[] });
export const fetchHints = (sessionId: string): Promise<SoloHints> => authed(`/solo/${sessionId}/hints`, 'GET', (v) => soloHintsSchema.parse(v));
/** The free nudge a level-1 player gets after standing still (403 `level` for everyone else: stop asking). */
export const takeNudge = (sessionId: string): Promise<HintPayload> =>
  authed(`/solo/${sessionId}/nudge`, 'POST', (v) => soloNudgeResultSchema.parse(v).hint, {}).then((h) => h);
export const takeHint = (sessionId: string, kind: HintKind): Promise<SoloHintResult> =>
  authed(`/solo/${sessionId}/hint`, 'POST', (v) => soloHintResultSchema.parse(v), { kind });
