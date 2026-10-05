import { isIosAgent } from '../pwa/logic';

/** What the web client is running on, from the user agent (D171). */
export type DeviceKind = 'android' | 'ios' | 'desktop';

export function deviceKind(env: { userAgent: string; maxTouchPoints: number }): DeviceKind {
  if (isIosAgent(env.userAgent, env.maxTouchPoints)) return 'ios';
  if (/Android/i.test(env.userAgent)) return 'android';
  return 'desktop';
}

/** `pass` = run the app; otherwise the card to show instead. */
export type GateVerdict = 'pass' | 'desktop' | 'android' | 'ios';

/**
 * The phone-only gate. Native builds, an installed PWA, a switched-off gate and a tester who chose «ادامه با مرورگر» all pass.
 * A desktop browser gets the QR card; an Android phone gets the download card; an iPhone gets the install steps.
 */
export function gateVerdict(env: { web: boolean; standalone: boolean; switchOn: boolean; escaped: boolean; kind: DeviceKind }): GateVerdict {
  if (!env.web || env.standalone || !env.switchOn || env.escaped) return 'pass';
  return env.kind;
}

/** The address the QR code points at: the admin's `link.app_url` when it is a web address, else the page being viewed. */
export function appAddress(setting: unknown, origin: string): string {
  return typeof setting === 'string' && /^https?:\/\//i.test(setting.trim()) ? setting.trim() : origin;
}

/** A download link is only ever a web address. */
export const downloadLink = (setting: unknown): string | null => (typeof setting === 'string' && /^https?:\/\//i.test(setting.trim()) ? setting.trim() : null);
