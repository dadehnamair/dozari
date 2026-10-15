import type { FastifyInstance } from 'fastify';
import type { LiveNotice } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import { pushTextOf } from './webpush.js';
import type { PushPayload } from './webpush.js';

export interface IrnotiPushConfig {
  /** Numeric id of that app (panel URL / `GET /sdk-apps`); used by the server-side send call. */
  appId: string;
  /** irnoti API key with the `broker.write` scope. */
  apiKey: string;
  baseUrl?: string;
}

/**
 * Android push through the irnoti push service. The irnoti Android SDK inside the app registers the device and links it to the
 * player (`Irnoti.identify(<player id>)`); the server only asks irnoti to deliver to that external id. Dozari never talks to Google.
 * Best-effort like the other push services: every failure resolves, never throws.
 */
export class IrnotiPushService {
  private readonly base: string;
  constructor(private readonly cfg: IrnotiPushConfig, private readonly http: typeof fetch = fetch) {
    this.base = (cfg.baseUrl ?? 'https://api.irnoti.com').replace(/\/$/, '');
  }

  /** Resolves true when irnoti accepted the send (it reports per-device outcomes in its own panel). */
  async notify(userId: string, payload: PushPayload): Promise<boolean> {
    try {
      const res = await this.http(`${this.base}/v1/sdk-apps/${this.cfg.appId}/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.cfg.apiKey}` },
        body: JSON.stringify({
          message: { title: payload.title, body: payload.body, channel: 'dozari', extra: { tag: payload.tag }, ttlSeconds: 3600 },
          target: { externalIds: [userId] },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async notice(userId: string, n: LiveNotice): Promise<void> {
    const payload = pushTextOf(n);
    if (payload) await this.notify(userId, payload);
  }
}

/** Reads the env vars; null (feature off) unless IRNOTI_PUSH_APP_ID and IRNOTI_API_KEY are both set. */
export function irnotiPushFromEnv(env: NodeJS.ProcessEnv, http?: typeof fetch): IrnotiPushService | null {
  const appId = env.IRNOTI_PUSH_APP_ID;
  const apiKey = env.IRNOTI_API_KEY;
  if (!appId || !apiKey) return null;
  return new IrnotiPushService({ appId, apiKey, baseUrl: env.IRNOTI_BASE_URL }, http);
}

/** The app asks which external id to hand to `Irnoti.identify`; it is the player id, so a push can never be addressed to someone else's account. */
export function registerIrnotiPushRoutes(app: FastifyInstance, auth: AuthService) {
  app.get('/push/irnoti', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return { externalId: user.id };
  });
}
