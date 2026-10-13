import { Platform } from 'react-native';
import type { LiveNotice } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';
import { keyBytes } from './keyBytes';
import { noticeNotification } from './noticeText';

/** The few browser APIs used here (the project compiles without the DOM lib). */
interface PushSubscriptionLike {
  toJSON: () => unknown;
}
interface Reg {
  pushManager?: { subscribe: (o: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) => Promise<PushSubscriptionLike>; getSubscription: () => Promise<PushSubscriptionLike | null> };
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
    const state = (await (g.Notification as NonNullable<Env['Notification']>).requestPermission()) as WebNotifyState;
    if (state === 'granted') void syncWebPush();
    return state;
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

/**
 * Subscribes this browser to Web Push and tells the server (D232). This is what reaches an iPhone whose home-screen app is in the
 * background: iOS suspends the page, so only a push from the server can wake it. Needs permission already granted; silent on failure
 * (no VAPID keys on the server, an old iOS, a browser without push). Safe to call on every Home open.
 */
export async function syncWebPush(): Promise<void> {
  if (!WEB || webNotifyState() !== 'granted') return;
  try {
    const sw = g.navigator?.serviceWorker;
    const reg = sw ? await sw.ready : null;
    if (!reg?.pushManager) return;
    const cfg = (await callJson('/push/config', 'GET')) as { publicKey?: string };
    if (!cfg.publicKey) return;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(cfg.publicKey) }));
    await session.authed(async (token) => {
      await callJson('/push/subscribe', 'POST', sub.toJSON(), token);
    });
  } catch {
    /* silent: the live notices and Bale still work */
  }
}
