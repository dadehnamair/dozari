import { createHmac, timingSafeEqual } from 'node:crypto';

/** What the Bale mini-app SDK hands the page (`Bale.WebApp.initData`) is verified here; nothing in it is trusted before that. */
export interface BaleMiniAppUser {
  id: string;
  firstName: string;
  username: string | null;
}

/** initData older than this is refused, so a leaked string cannot log in forever. */
export const BALE_INIT_DATA_MAX_AGE_SEC = 24 * 60 * 60;

const safeEqualHex = (a: string, b: string): boolean => {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
};

export type BaleInitDataCheck = { ok: true; user: BaleMiniAppUser } | { ok: false; reason: 'no_hash' | 'bad_signature' | 'stale' | 'no_user' };

/**
 * Bale mini-apps sign `initData` like Telegram web apps: `hash` = HMAC-SHA256 of the sorted `key=value` lines (without `hash`),
 * keyed by HMAC-SHA256("WebAppData", botToken). Bale's docs word the key step the other way round (HMAC of the token keyed by
 * "WebAppData" vs. the reverse), so both are accepted; either needs the bot token, so neither weakens the check.
 * Not yet run against the live Bale servers (docs/logic/bale-miniapp.md).
 */
export function checkBaleInitData(initData: string, botToken: string, nowMs: number = Date.now()): BaleInitDataCheck {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'no_hash' };
  params.delete('hash');
  const check = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secrets = [createHmac('sha256', 'WebAppData').update(botToken).digest(), createHmac('sha256', botToken).update('WebAppData').digest()];
  if (!secrets.some((secret) => safeEqualHex(createHmac('sha256', secret).update(check).digest('hex'), hash))) return { ok: false, reason: 'bad_signature' };

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || nowMs / 1000 - authDate > BALE_INIT_DATA_MAX_AGE_SEC) return { ok: false, reason: 'stale' };

  try {
    const user = JSON.parse(params.get('user') ?? '') as { id?: number | string; first_name?: string; username?: string };
    if (user.id === undefined || !/^\d{1,20}$/.test(String(user.id))) return { ok: false, reason: 'no_user' };
    return { ok: true, user: { id: String(user.id), firstName: user.first_name ?? '', username: user.username ?? null } };
  } catch {
    return { ok: false, reason: 'no_user' };
  }
}

/** The verified user, or null. */
export function verifyBaleInitData(initData: string, botToken: string, nowMs: number = Date.now()): BaleMiniAppUser | null {
  const r = checkBaleInitData(initData, botToken, nowMs);
  return r.ok ? r.user : null;
}

/**
 * The device id a Bale user always logs in with: stable per Bale account, unguessable without the bot token, and shaped like the
 * ids the guest login accepts (32 hex characters). So a mini-app player keeps one account across every device and visit.
 */
export function baleDeviceId(botToken: string, baleUserId: string): string {
  return createHmac('sha256', botToken).update(`dozari-bale-miniapp:${baleUserId}`).digest('hex').slice(0, 32);
}
