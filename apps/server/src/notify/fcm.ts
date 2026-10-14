import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, fcmTokens } from '@dozari/db';
import type { Db } from '@dozari/db';
import type { LiveNotice } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import { pushTextOf } from './webpush.js';
import type { PushPayload } from './webpush.js';

/** I/O boundary: the Android installs a player is signed in on. */
export interface FcmTokenStore {
  add(userId: string, token: string): Promise<void>;
  remove(token: string): Promise<void>;
  of(userId: string): Promise<string[]>;
}

/** Sends one data message to one device; resolves the HTTP status FCM answered (404 = the token is gone). */
export type FcmSender = (token: string, payload: PushPayload) => Promise<number>;

export function createDbFcmTokenStore(db: Db): FcmTokenStore {
  return {
    async add(userId, token) {
      await db.delete(fcmTokens).where(eq(fcmTokens.token, token));
      await db.insert(fcmTokens).values({ id: uuidv7(), userId, token });
    },
    async remove(token) {
      await db.delete(fcmTokens).where(eq(fcmTokens.token, token));
    },
    async of(userId) {
      return (await db.select({ token: fcmTokens.token }).from(fcmTokens).where(eq(fcmTokens.userId, userId))).map((r) => r.token);
    },
  };
}

export function createMemoryFcmTokenStore(): FcmTokenStore & { all: Map<string, string> } {
  const all = new Map<string, string>();
  return {
    all,
    async add(userId, token) {
      all.set(token, userId);
    },
    async remove(token) {
      all.delete(token);
    },
    async of(userId) {
      return [...all].filter(([, u]) => u === userId).map(([t]) => t);
    },
  };
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** The signed JWT a Google service account exchanges for an access token (RS256). Pure apart from the clock argument; tested. */
export function serviceAccountJwt(account: { client_email: string; private_key: string }, nowSec: number): string {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: nowSec, exp: nowSec + 3600 }));
  const signature = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(account.private_key);
  return `${head}.${claims}.${b64url(signature)}`;
}

export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

/** The service-account key from `FCM_SERVICE_ACCOUNT_JSON`: JSON text, or the path of a JSON file. Null when unset or unreadable. */
export function loadServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw.trim().startsWith('{') ? raw : readFileSync(raw, 'utf8')) as Partial<ServiceAccount>;
    return j.project_id && j.client_email && j.private_key ? { project_id: j.project_id, client_email: j.client_email, private_key: j.private_key } : null;
  } catch {
    return null;
  }
}

/** FCM HTTP v1 without any SDK: an OAuth token from the service-account key (cached), then one POST per device. Data-only messages, so the app builds the notification itself. */
export function createFcmSender(account: ServiceAccount, http: typeof fetch = fetch, now: () => number = Date.now): FcmSender {
  let cached: { token: string; until: number } | null = null;
  const accessToken = async (): Promise<string | null> => {
    if (cached && cached.until > now()) return cached.token;
    const res = await http('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: serviceAccountJwt(account, Math.floor(now() / 1000)) }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) return null;
    cached = { token: j.access_token, until: now() + ((j.expires_in ?? 3600) - 120) * 1000 };
    return j.access_token;
  };
  return async (token, payload) => {
    try {
      const bearer = await accessToken();
      if (!bearer) return 0;
      const res = await http(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
        method: 'POST',
        headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
        body: JSON.stringify({ message: { token, data: { title: payload.title, body: payload.body, tag: payload.tag }, android: { priority: 'HIGH', ttl: '3600s' } } }),
      });
      if (res.status === 401) cached = null;
      return res.status;
    } catch {
      return 0;
    }
  };
}

export class FcmService {
  constructor(
    private readonly store: FcmTokenStore,
    private readonly send: FcmSender,
  ) {}

  register(userId: string, token: string): Promise<void> {
    return this.store.add(userId, token);
  }

  unregister(token: string): Promise<void> {
    return this.store.remove(token);
  }

  /** Pushes to every Android install of the player; a token FCM calls unknown (404) is deleted. Returns how many were delivered. */
  async notify(userId: string, payload: PushPayload): Promise<number> {
    let ok = 0;
    for (const token of await this.store.of(userId)) {
      const status = await this.send(token, payload);
      if (status >= 200 && status < 300) ok += 1;
      else if (status === 404) await this.store.remove(token);
    }
    return ok;
  }

  async notice(userId: string, n: LiveNotice): Promise<void> {
    const payload = pushTextOf(n);
    if (payload) await this.notify(userId, payload);
  }
}

export function registerFcmRoutes(app: FastifyInstance, auth: AuthService, fcm: FcmService) {
  const body = z.object({ token: z.string().min(20).max(400) });
  app.post('/push/fcm', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const b = body.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
    await fcm.register(user.id, b.data.token);
    return { ok: true };
  });
  app.post('/push/fcm/remove', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const b = body.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
    await fcm.unregister(b.data.token);
    return { ok: true };
  });
}
