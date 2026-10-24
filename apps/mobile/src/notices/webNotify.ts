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
interface ScriptEl {
  src: string;
  async: boolean;
  onload: () => void;
  onerror: () => void;
  setAttribute: (k: string, v: string) => void;
}
interface IrnotiPushApi {
  /** Asks for permission (already granted here), registers the browser with irnoti and links it to `externalId`. */
  subscribe: (o: { externalId?: string; tags?: Record<string, string> }) => Promise<{ deviceId: string }>;
}
interface Env {
  IRNotiPush?: IrnotiPushApi;
  document?: { visibilityState: string; createElement?: (tag: string) => unknown; head?: { appendChild: (el: unknown) => void } };
  Notification?: { permission: string; requestPermission: () => Promise<string> };
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

const IRNOTI_SDK = 'https://api.irnoti.com/v1/sdk/web/push.js';
let irnotiLoaded: Promise<IrnotiPushApi | null> | null = null;

/** Loads the irnoti browser SDK once, with the public key from the admin panel. Resolves null when it cannot load. */
function loadIrnoti(publicKey: string): Promise<IrnotiPushApi | null> {
  irnotiLoaded ??= new Promise((resolve) => {
    const doc = g.document;
    if (!doc?.createElement || !doc.head) return resolve(null);
    const el = doc.createElement('script') as ScriptEl;
    el.src = IRNOTI_SDK;
    el.async = true;
    el.setAttribute('data-key', publicKey);
    el.onload = () => resolve(g.IRNotiPush ?? null);
    el.onerror = () => resolve(null);
    doc.head.appendChild(el);
  });
  return irnotiLoaded;
}

/**
 * Web push through irnoti (admin panel → اعلان وب). Registers the browser with irnoti and links it to the player id, which is what the
 * server addresses. Returns false when the route is off or the SDK is unavailable, so the caller falls back to our own VAPID push.
 */
async function syncIrnotiWeb(): Promise<boolean> {
  try {
    const cfg = (await callJson('/push/irnoti-web', 'GET')) as { publicKey?: string | null };
    if (!cfg.publicKey) return false;
    const api = await loadIrnoti(cfg.publicKey);
    if (!api) return false;
    let linked = false;
    await session.authed(async (token) => {
      const r = (await callJson('/push/irnoti', 'GET', undefined, token)) as { externalId?: string };
      if (!r.externalId) return;
      // The SDK's `identify` takes a profile, not an id: the player id goes in as `externalId` of `subscribe` (that is what the server sends to).
      await api.subscribe({ externalId: r.externalId, tags: { app: 'dozari' } });
      linked = true;
    });
    return linked;
  } catch (e) {
    console.warn('[irnoti-web] subscribe failed, using our own web push', e);
    return false;
  }
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
    // irnoti's browser SDK, when the admin has set it up, replaces our own VAPID subscription (otherwise one event would show twice).
    if (await syncIrnotiWeb()) {
      const old = await reg?.pushManager?.getSubscription();
      const json = old?.toJSON() as { endpoint?: string } | undefined;
      if (json?.endpoint) await session.authed(async (token) => void (await callJson('/push/unsubscribe', 'POST', { endpoint: json.endpoint }, token))).catch(() => undefined); // only forgets it on our server
      return;
    }
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
