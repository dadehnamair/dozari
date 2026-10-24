import type { FastifyInstance } from 'fastify';
import type { LiveNotice } from '@dozari/shared';
import type { SettingsStore } from '../settings/service.js';
import { IrnotiPushService } from './irnoti-push.js';
import { pushTextOf } from './webpush.js';
import type { PushPayload } from './webpush.js';

const K = {
  publicKey: 'irnoti_web.public_key',
  appId: 'irnoti_web.app_id',
  apiKey: 'irnoti_web.api_key',
} as const;

export const IRNOTI_WEB_PUBLIC_KEY_RE = /^pk_[a-z]+_[A-Za-z0-9]{8,100}$/;
export const IRNOTI_WEB_APP_ID_RE = /^\d{1,12}$/;

export interface IrnotiWebAdminState {
  /** True when the public key, the app id and an API key are all there: the site loads the irnoti SDK and the server sends through it. */
  active: boolean;
  publicKey: string;
  appId: string;
  apiKeyMask: string | null;
  apiKeyFromEnv: boolean;
}

export interface IrnotiWebPatch {
  /** undefined = keep, '' = remove. */
  publicKey?: string;
  appId?: string;
  apiKey?: string;
}

const mask = (key: string | undefined): string | null => (key ? `••••${key.slice(-4)}` : null);

/**
 * Web push through irnoti's browser SDK (`push.js` + `irnoti-sw.js`). The three values come from the irnoti panel and are typed in the admin panel
 * (`app_settings`; `IRNOTI_API_KEY` is the fallback API key, shared with the Android route). The browser links itself to the player id
 * (`/push/irnoti`), the server asks irnoti to deliver to that external id. Reads the store on every call, so an admin change applies at once.
 * Best-effort like the other push services: a failure never throws.
 */
export class IrnotiWebPush {
  /** Synchronous snapshot taken by `refresh()` (boot and every save), for callers that check availability in a sync getter. */
  configured = false;

  constructor(
    private readonly store: SettingsStore,
    private readonly envApiKey?: string,
    private readonly baseUrl?: string,
    private readonly http: typeof fetch = fetch,
  ) {}

  private async resolve(): Promise<{ publicKey: string; appId: string; apiKey: string } | null> {
    const raw = await this.store.all();
    const publicKey = raw[K.publicKey];
    const appId = raw[K.appId];
    const apiKey = raw[K.apiKey] || this.envApiKey;
    return publicKey && appId && apiKey ? { publicKey, appId, apiKey } : null;
  }

  async refresh(): Promise<void> {
    this.configured = (await this.resolve()) !== null;
  }

  /** The key the page needs to load the SDK; null = this route is off. */
  async publicKey(): Promise<string | null> {
    return (await this.resolve())?.publicKey ?? null;
  }

  async adminState(): Promise<IrnotiWebAdminState> {
    const raw = await this.store.all();
    const apiKey = raw[K.apiKey] || this.envApiKey;
    return {
      active: !!(raw[K.publicKey] && raw[K.appId] && apiKey),
      publicKey: raw[K.publicKey] ?? '',
      appId: raw[K.appId] ?? '',
      apiKeyMask: mask(apiKey),
      apiKeyFromEnv: !raw[K.apiKey] && !!this.envApiKey,
    };
  }

  async update(patch: IrnotiWebPatch): Promise<void> {
    const put = async (key: string, v: string | undefined) => {
      if (v === undefined) return;
      if (v === '') await this.store.remove(key);
      else await this.store.set(key, v);
    };
    await put(K.publicKey, patch.publicKey);
    await put(K.appId, patch.appId);
    await put(K.apiKey, patch.apiKey);
    await this.refresh();
  }

  /** Resolves true when irnoti accepted the send. No deep link: it is a `dozari://` address, which a browser cannot open. */
  async notify(userId: string, payload: PushPayload): Promise<boolean> {
    const cfg = await this.resolve();
    if (!cfg) return false;
    const plain: PushPayload = { title: payload.title, body: payload.body, tag: payload.tag };
    return new IrnotiPushService({ appId: cfg.appId, apiKey: cfg.apiKey, baseUrl: this.baseUrl }, this.http).notify(userId, plain);
  }

  async notice(userId: string, n: LiveNotice): Promise<void> {
    const payload = pushTextOf(n);
    if (payload) await this.notify(userId, payload);
  }
}

/** The page asks which key to load the irnoti SDK with. It is a public key (`pk_live_…`); an empty answer means the route is off. */
export function registerIrnotiWebRoutes(app: FastifyInstance, web: IrnotiWebPush) {
  app.get('/push/irnoti-web', async () => ({ publicKey: (await web.publicKey()) ?? null }));
}
