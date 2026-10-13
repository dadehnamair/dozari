import { Platform } from 'react-native';
import type { LiveNotice } from '@dozari/shared';
import { noticeNotification } from './noticeText';

/** The few browser APIs used here (the project compiles without the DOM lib). */
interface Reg {
  showNotification: (title: string, opts: { body: string; tag: string; icon: string; lang: string; dir: string }) => Promise<void>;
}
interface Env {
  Notification?: { permission: string; requestPermission: () => Promise<string> };
  document?: { visibilityState: string };
  navigator?: { serviceWorker?: { ready: Promise<Reg> } };
}
const g = globalThis as unknown as Env;
const WEB = Platform.OS === 'web' && g.Notification !== undefined;

export type WebNotifyState = 'unsupported' | 'default' | 'granted' | 'denied';

export const webNotifyState = (): WebNotifyState => (WEB ? ((g.Notification as NonNullable<Env['Notification']>).permission as WebNotifyState) : 'unsupported');

/** Asks the browser for permission; call it from a tap (browsers refuse otherwise). */
export async function enableWebNotify(): Promise<WebNotifyState> {
  if (!WEB) return 'unsupported';
  try {
    return (await (g.Notification as NonNullable<Env['Notification']>).requestPermission()) as WebNotifyState;
  } catch {
    return webNotifyState();
  }
}

/** Shows a browser notification for a live notice, only while the page is hidden and permission is granted. Never throws. */
export function showWebNotice(n: LiveNotice): void {
  if (!WEB || webNotifyState() !== 'granted' || g.document?.visibilityState !== 'hidden') return;
  const c = noticeNotification(n);
  const sw = g.navigator?.serviceWorker;
  if (!c || !sw) return;
  void sw.ready.then((reg) => reg.showNotification(c.title, { body: c.body, tag: c.tag, icon: '/icon-192.png', lang: 'fa', dir: 'rtl' })).catch(() => undefined);
}
