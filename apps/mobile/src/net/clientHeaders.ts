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

/**
 * Tells the server which app is calling: platform, OS version, build and market. It is only for the admin panel's «آخرین دستگاه»
 * (support and install-source questions); the server never trusts it for access decisions.
 */
export function clientHeaders(): Record<string, string> {
  const { os, version } = platformInfo();
  return { 'x-client-platform': os, 'x-client-os': version.slice(0, 24), 'x-client-build': String(APP_BUILD), 'x-client-store': APP_STORE ?? '' };
}
