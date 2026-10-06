import { shopSchema, soloHintResultSchema, soloHintsSchema, soloNudgeResultSchema } from '@dozari/shared';
import type { HintKind, HintPayload, Shop, SoloHintResult, SoloHints } from '@dozari/shared';
import { session } from '../auth';
import { baleInvoiceHost, openInvoice } from '../miniapp/host';
import type { InvoiceStatus } from '../miniapp/host';
import { callJson } from '../net/http';

const authed = <T>(path: string, method: 'GET' | 'POST', parse: (v: unknown) => T, body?: unknown): Promise<T> =>
  session.authed(async (token) => parse(await callJson(path, method, body, token)));

export const fetchShop = (): Promise<Shop> => authed('/shop', 'GET', (v) => shopSchema.parse(v));
export const buyItem = (id: string): Promise<{ balance: number; gems: number; tokens: number }> =>
  authed(`/shop/${id}/buy`, 'POST', (v) => v as { balance: number; gems: number; tokens: number });
/**
 * Buys a shop item with real money (D170). Inside the Bale mini-app (the one host with in-app payment) the server returns a payment link and Bale's own payment page opens
 * (resolves with how it ended); elsewhere the server sends the invoice into the player's linked Bale chat (resolves `sent`).
 */
export async function payWithMoney(id: string): Promise<'sent' | InvoiceStatus> {
  const sdk = baleInvoiceHost();
  if (!sdk) return authed(`/shop-pay/${id}/bale-invoice`, 'POST', () => 'sent' as const);
  const { link } = await authed(`/shop-pay/${id}/bale-invoice-link`, 'POST', (v) => v as { link: string });
  return openInvoice(sdk, link);
}
export const equipItem = (id: string, equipped: boolean): Promise<{ ok: true }> => authed(`/shop/${id}/equip`, 'POST', (v) => v as { ok: true }, { equipped });
export const fetchWorn = (): Promise<{ worn: { id: string; slot: string; iconKey: string | null }[] }> => authed('/me/cosmetics', 'GET', (v) => v as { worn: { id: string; slot: string; iconKey: string | null }[] });
export const fetchHints = (sessionId: string): Promise<SoloHints> => authed(`/solo/${sessionId}/hints`, 'GET', (v) => soloHintsSchema.parse(v));
/** The free nudge a level-1 player gets after standing still (403 `level` for everyone else: stop asking). */
export const takeNudge = (sessionId: string): Promise<HintPayload> =>
  authed(`/solo/${sessionId}/nudge`, 'POST', (v) => soloNudgeResultSchema.parse(v).hint, {}).then((h) => h);
export const takeHint = (sessionId: string, kind: HintKind): Promise<SoloHintResult> =>
  authed(`/solo/${sessionId}/hint`, 'POST', (v) => soloHintResultSchema.parse(v), { kind });
/** A small gift from the shop for a friend in their birthday week. */
export const giftItem = (itemId: string, friendId: string): Promise<{ ok: true; balance: number }> => authed('/shop/gift', 'POST', (v) => v as { ok: true; balance: number }, { itemId, friendId });
