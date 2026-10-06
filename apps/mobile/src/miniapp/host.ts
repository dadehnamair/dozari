import { Platform } from 'react-native';

/** The slice of a messenger's mini-app SDK the game uses (Bale `window.Bale.WebApp`, Telegram `window.Telegram.WebApp`; docs/logic/miniapp.md). */
export interface MiniAppSdk {
  initData: string;
  openInvoice?(link: string, callback?: (result: { status: string }) => void): void;
  BackButton?: { show(): void; hide(): void; onClick(callback: () => void): void; offClick(callback: () => void): void };
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
  const g = globalThis as { Bale?: { WebApp?: MiniAppSdk }; Telegram?: { WebApp?: MiniAppSdk } };
  if (g.Bale?.WebApp?.initData) return { platform: 'bale', sdk: g.Bale.WebApp };
  if (g.Telegram?.WebApp?.initData) return { platform: 'telegram', sdk: g.Telegram.WebApp };
  return null;
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
