import { Platform } from 'react-native';

/** The slice of Bale's mini-app SDK the game uses (https://tapi.bale.ai/miniapp.js; docs/logic/bale-miniapp.md). */
export interface BaleWebApp {
  initData: string;
  openInvoice(link: string, callback?: (result: { status: string }) => void): void;
  BackButton?: { show(): void; hide(): void; onClick(callback: () => void): void; offClick(callback: () => void): void };
}

export type InvoiceStatus = 'paid' | 'cancelled' | 'failed' | 'pending';

/** The SDK when the game runs inside a Bale mini-app (signed `initData` present); null in a plain browser or on a phone build. */
export function baleWebApp(): BaleWebApp | null {
  if (Platform.OS !== 'web') return null;
  const app = (globalThis as { Bale?: { WebApp?: BaleWebApp } }).Bale?.WebApp;
  return app?.initData && typeof app.openInvoice === 'function' ? app : null;
}

/** Opens Bale's payment page for an invoice link and resolves with how it ended (a closed page counts as `cancelled`). */
export function openBaleInvoice(app: BaleWebApp, link: string): Promise<InvoiceStatus> {
  return new Promise((resolve) => {
    app.openInvoice(link, (r) => resolve(['paid', 'failed', 'pending'].includes(r?.status) ? (r.status as InvoiceStatus) : 'cancelled'));
  });
}
