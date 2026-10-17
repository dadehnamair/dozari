import { Platform } from 'react-native';

/** The slice of a messenger's mini-app SDK the game uses (Bale `window.Bale.WebApp`, Telegram `window.Telegram.WebApp`; docs/logic/miniapp.md). */
export interface MiniAppSdk {
  initData: string;
  openInvoice?(link: string, callback?: (result: { status: string }) => void): void;
  BackButton?: { show(): void; hide(): void; onClick(callback: () => void): void; offClick(callback: () => void): void };
  /** Telegram-style: the host asks the player to share their own contact with the bot; `shared` says whether they agreed. */
  requestContact?(callback?: (shared: boolean) => void): void;
  enableClosingConfirmation?(): void;
  disableClosingConfirmation?(): void;
}

export type MiniAppPlatform = 'bale' | 'telegram';
export interface MiniAppHost {
  platform: MiniAppPlatform;
  sdk: MiniAppSdk;
}

export type InvoiceStatus = 'paid' | 'cancelled' | 'failed' | 'pending';

/** The messenger the game runs in as a mini-app (signed `initData` present); null in a plain browser or on a phone build. */
export function miniAppHost(): MiniAppHost | null {
  if (Platform.OS !== 'web') return null;
  const g = globalThis as { Bale?: { WebApp?: MiniAppSdk }; Telegram?: { WebApp?: MiniAppSdk }; __MINIAPP__?: { platform?: string } };
  const bale = g.Bale?.WebApp?.initData ? { platform: 'bale' as const, sdk: g.Bale.WebApp } : null;
  const telegram = g.Telegram?.WebApp?.initData ? { platform: 'telegram' as const, sdk: g.Telegram.WebApp } : null;
  // Bale's SDK also reads Telegram's launch data, so both can look present: the messenger whose signature the server accepted (set by the page's bridge) wins.
  if (g.__MINIAPP__?.platform === 'telegram') return telegram ?? bale;
  return bale ?? telegram;
}

/** Bale's payment page is the only in-app payment the game has (`createInvoiceLink` + `openInvoice`). */
export function baleInvoiceHost(): MiniAppSdk | null {
  const host = miniAppHost();
  return host?.platform === 'bale' && typeof host.sdk.openInvoice === 'function' ? host.sdk : null;
}

/** Opens the payment page for an invoice link and resolves with how it ended (a closed page counts as `cancelled`). */
export function openInvoice(sdk: MiniAppSdk, link: string): Promise<InvoiceStatus> {
  return new Promise((resolve) => {
    sdk.openInvoice?.(link, (r) => resolve(['paid', 'failed', 'pending'].includes(r?.status) ? (r.status as InvoiceStatus) : 'cancelled'));
  });
}

/** The host's «share my phone number with the bot» call, or null when this is not a mini-app (or an old client without it). */
export function contactHost(): MiniAppSdk | null {
  const host = miniAppHost();
  return host && typeof host.sdk.requestContact === 'function' ? host.sdk : null;
}

/** Asks the host to share the player's contact with the bot; true when they agreed (the bot then verifies the number, the app only re-reads the status). */
export function requestContact(sdk: MiniAppSdk): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: boolean) => !done && ((done = true), resolve(v));
    try {
      sdk.requestContact?.((shared) => finish(shared === true));
    } catch {
      finish(false);
    }
    setTimeout(() => finish(false), 120_000);
  });
}
