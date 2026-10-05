import { createHmac, timingSafeEqual } from 'node:crypto';

/** Mini-app hosts (messengers) the login understands. Both sign `initData` the same way, each with its own bot's token. */
export type MiniAppPlatform = 'bale' | 'telegram';

/** What a mini-app SDK hands the page (`WebApp.initData`) is verified here; nothing in it is trusted before that. */
export interface MiniAppUser {
  id: string;
  firstName: string;
  username: string | null;
}

/** initData older than this is refused, so a leaked string cannot log in forever. */
export const INIT_DATA_MAX_AGE_SEC = 24 * 60 * 60;

const safeEqualHex = (a: string, b: string): boolean => {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
};

export type MiniAppInitDataCheck = { ok: true; user: MiniAppUser } | { ok: false; reason: 'no_hash' | 'bad_signature' | 'stale' | 'no_user' };

/**
 * Mini-apps (Bale, Telegram) sign `initData` the same way: `hash` = HMAC-SHA256 of the sorted `key=value` lines (without `hash`),
 * keyed by HMAC-SHA256("WebAppData", botToken). Bale's docs word the key step the other way round (HMAC of the token keyed by
 * "WebAppData" vs. the reverse), so both are accepted; either needs the bot token, so neither weakens the check.
 * Not yet run against the live Bale servers (docs/logic/miniapp.md).
 */
export function checkMiniAppInitData(initData: string, botToken: string, nowMs: number = Date.now()): MiniAppInitDataCheck {
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
  if (!Number.isFinite(authDate) || nowMs / 1000 - authDate > INIT_DATA_MAX_AGE_SEC) return { ok: false, reason: 'stale' };

  try {
    const user = JSON.parse(params.get('user') ?? '') as { id?: number | string; first_name?: string; username?: string };
    if (user.id === undefined || !/^\d{1,20}$/.test(String(user.id))) return { ok: false, reason: 'no_user' };
    return { ok: true, user: { id: String(user.id), firstName: user.first_name ?? '', username: user.username ?? null } };
  } catch {
    return { ok: false, reason: 'no_user' };
  }
}

/** The verified user, or null. */
export function verifyMiniAppInitData(initData: string, botToken: string, nowMs: number = Date.now()): MiniAppUser | null {
  const r = checkMiniAppInitData(initData, botToken, nowMs);
  return r.ok ? r.user : null;
}

/**
 * The device id a mini-app user always logs in with: stable per messenger account, unguessable without the bot token, and shaped like
 * the ids the guest login accepts (32 hex characters). So a player keeps one account across every device and visit. The Bale message
 * text is the one the first release used, so existing accounts keep working; Telegram gets its own, so the two id spaces never meet.
 */
export function miniAppDeviceId(botToken: string, userId: string, platform: MiniAppPlatform = 'bale'): string {
  return createHmac('sha256', botToken).update(`dozari-${platform}-miniapp:${userId}`).digest('hex').slice(0, 32);
}
