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

/**
 * Bale mini-apps sign `initData` like Telegram web apps: `hash` = HMAC-SHA256 of the sorted `key=value` lines (without `hash`),
 * keyed by HMAC-SHA256("WebAppData", botToken). Returns the user, or null for a bad signature, a stale `auth_date`, or no user.
 * Not yet run against the live Bale servers (docs/logic/bale-miniapp.md).
 */
export function verifyBaleInitData(initData: string, botToken: string, nowMs: number = Date.now()): BaleMiniAppUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const check = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(check).digest('hex');
  if (!safeEqualHex(expected, hash)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || nowMs / 1000 - authDate > BALE_INIT_DATA_MAX_AGE_SEC) return null;

  try {
    const user = JSON.parse(params.get('user') ?? '') as { id?: number | string; first_name?: string; username?: string };
    if (user.id === undefined || !/^\d{1,20}$/.test(String(user.id))) return null;
    return { id: String(user.id), firstName: user.first_name ?? '', username: user.username ?? null };
  } catch {
    return null;
  }
}

/**
 * The device id a Bale user always logs in with: stable per Bale account, unguessable without the bot token, and shaped like the
 * ids the guest login accepts (32 hex characters). So a mini-app player keeps one account across every device and visit.
 */
export function baleDeviceId(botToken: string, baleUserId: string): string {
  return createHmac('sha256', botToken).update(`dozari-bale-miniapp:${baleUserId}`).digest('hex').slice(0, 32);
}
