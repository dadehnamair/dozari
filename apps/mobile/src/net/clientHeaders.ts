import { APP_BUILD, APP_STORE } from '../config/build';

/** `react-native` is loaded on first use, so the plain-node unit tests that reach `callJson` never have to resolve it. */
function platformInfo(): { os: string; version: string } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require('react-native') as { Platform: { OS: string; Version?: string | number } };
    return { os: Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : 'web', version: String(Platform.Version ?? '') };
  } catch {
    return { os: 'web', version: '' };
  }
}

/** True when the web build runs as an installed home-screen app (PWA) rather than in a browser tab. */
function isInstalledPwa(os: string): boolean {
  if (os !== 'web') return false;
  try {
    const w = globalThis as unknown as { matchMedia?: (q: string) => { matches: boolean }; navigator?: { standalone?: boolean } };
    return w.matchMedia?.('(display-mode: standalone)').matches === true || w.navigator?.standalone === true;
  } catch {
    return false;
  }
}

/** The link source the mini-app bridge kept (`g<ref>` from a bot group's `?startapp=daily_g<ref>`), web only. */
function linkSource(os: string): string {
  if (os !== 'web') return '';
  try {
    const v = (globalThis as unknown as { localStorage?: { getItem(k: string): string | null } }).localStorage?.getItem('dozari_src') ?? '';
    return /^g[a-z0-9]{4,12}$/.test(v) ? v : '';
  } catch {
    return '';
  }
}

/**
 * Tells the server which app is calling: platform, OS version, build and market. It is only for the admin panel's «آخرین دستگاه»
 * (support and install-source questions); the server never trusts it for access decisions.
 */
export function clientHeaders(): Record<string, string> {
  const { os, version } = platformInfo();
  return { 'x-client-platform': os, 'x-client-os': version.slice(0, 24), 'x-client-build': String(APP_BUILD), 'x-client-store': APP_STORE ?? '', 'x-client-pwa': isInstalledPwa(os) ? '1' : '', 'x-client-src': linkSource(os) };
}
