import { createHmac } from 'node:crypto';

/** Mini-app hosts (messengers) that have a bot token on the server. Both sign `initData` the same way, each with its own bot's token. */
export type MiniAppPlatform = 'bale' | 'telegram';

/** Bot tokens of the messengers that host the mini-app; a platform without a token is off. */
export type MiniAppTokens = Partial<Record<MiniAppPlatform, string>>;

/**
 * The device id the mini-app login used to give a messenger user (D243 removed that login): stable per messenger account, unguessable without the bot token,
 * and shaped like a guest device id (32 hex characters). Kept so accounts made that way still map to their messenger id (Bale payments, `NotifyService.miniAppUserOf`). The Bale message
 * text is the one the first release used, so existing accounts keep working; Telegram gets its own, so the two id spaces never meet.
 */
export function miniAppDeviceId(botToken: string, userId: string, platform: MiniAppPlatform = 'bale'): string {
  return createHmac('sha256', botToken).update(`dozari-${platform}-miniapp:${userId}`).digest('hex').slice(0, 32);
}
