import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, webPushSubscriptions } from '@dozari/db';
import type { Db } from '@dozari/db';
import type { LiveNotice } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';
import webpush from 'web-push';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import { BALE_TEXT } from './texts.js';

export interface PushSub {
  endpoint: string;
  p256dh: string;
  auth: string;
}
export interface PushPayload {
  title: string;
  body: string;
  tag: string;
  /** `dozari://open/…` link the Android push opens on tap (see `deepLinkOf`). */
  deeplink?: string;
}

/** I/O boundary: where a player's browser subscriptions live. */
export interface PushSubStore {
  add(userId: string, sub: PushSub): Promise<void>;
  remove(endpoint: string): Promise<void>;
  of(userId: string): Promise<PushSub[]>;
}

/** Sends one encrypted push to one subscription; resolves the HTTP status the push service answered (404/410 = the subscription is gone). */
export type PushSender = (sub: PushSub, payload: PushPayload) => Promise<number>;

export function createDbPushSubStore(db: Db): PushSubStore {
  return {
    async add(userId, sub) {
      // The same browser can switch accounts: the newest owner wins.
      await db.delete(webPushSubscriptions).where(eq(webPushSubscriptions.endpoint, sub.endpoint));
      await db.insert(webPushSubscriptions).values({ id: uuidv7(), userId, ...sub });
    },
    async remove(endpoint) {
      await db.delete(webPushSubscriptions).where(eq(webPushSubscriptions.endpoint, endpoint));
    },
    async of(userId) {
      return db.select({ endpoint: webPushSubscriptions.endpoint, p256dh: webPushSubscriptions.p256dh, auth: webPushSubscriptions.auth }).from(webPushSubscriptions).where(eq(webPushSubscriptions.userId, userId));
    },
  };
}

export function createMemoryPushSubStore(): PushSubStore & { all: Map<string, PushSub & { userId: string }> } {
  const all = new Map<string, PushSub & { userId: string }>();
  return {
    all,
    async add(userId, sub) {
      all.set(sub.endpoint, { userId, ...sub });
    },
    async remove(endpoint) {
      all.delete(endpoint);
    },
    async of(userId) {
      return [...all.values()].filter((s) => s.userId === userId).map(({ endpoint, p256dh, auth }) => ({ endpoint, p256dh, auth }));
    },
  };
}

/** The real sender: VAPID-signed Web Push. Needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (a `mailto:` or https URL). */
export function createVapidSender(keys: { publicKey: string; privateKey: string; subject: string }): PushSender {
  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  return async (sub, payload) => {
    try {
      const res = await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: 'high' });
      return res.statusCode;
    } catch (err) {
      return (err as { statusCode?: number }).statusCode ?? 0;
    }
  };
}

/** What a live notice says as a push. Same wording as the Bale texts. */
/** Where a tap on the push should land inside the app; null = just open the app. The app parses it in `apps/mobile/src/notices/deepLink.ts`. */
export function deepLinkOf(n: LiveNotice): string | null {
  switch (n.kind) {
    case 'dm':
      return n.fromId ? `dozari://open/dm/${n.fromId}` : 'dozari://open/friends';
    case 'friend_request':
      return 'dozari://open/friends';
    case 'table_invite':
      return n.code ? `dozari://open/table/${encodeURIComponent(n.code)}` : null;
    case 'table_request':
      return n.code ? `dozari://open/table/${encodeURIComponent(n.code)}` : null;
    case 'inbox':
      return 'dozari://open/inbox';
    default:
      return null;
  }
}

export function pushTextOf(n: LiveNotice): PushPayload | null {
  const from = n.from ?? '';
  switch (n.kind) {
    case 'friend_request':
      return { title: 'دوزاری', body: BALE_TEXT.friendRequest(from), tag: 'friend_request' };
    case 'dm':
      return { title: 'دوزاری', body: BALE_TEXT.chatMessage(from), tag: `dm:${from}` };
    case 'table_invite':
      return { title: 'دوزاری', body: BALE_TEXT.tableInvite(from), tag: `table_invite:${n.code ?? ''}` };
    case 'table_request':
      return { title: 'دوزاری', body: BALE_TEXT.tableRequest(from), tag: `table_request:${n.code ?? ''}:${from}` };
    default:
      return null; // only what needs a person is pushed (friend request, private message, table invite/request); inbox news and table answers wait in-app
  }
}

export class WebPushService {
  constructor(
    private readonly store: PushSubStore,
    private readonly send: PushSender,
    readonly publicKey: string,
  ) {}

  subscribe(userId: string, sub: PushSub): Promise<void> {
    return this.store.add(userId, sub);
  }

  unsubscribe(endpoint: string): Promise<void> {
    return this.store.remove(endpoint);
  }

  /** Pushes to every browser of the player; subscriptions the push service reports gone (404/410) are deleted. Returns how many were delivered. */
  async notify(userId: string, payload: PushPayload): Promise<number> {
    let ok = 0;
    for (const sub of await this.store.of(userId)) {
      const status = await this.send(sub, payload);
      if (status >= 200 && status < 300) ok += 1;
      else if (status === 404 || status === 410) await this.store.remove(sub.endpoint);
    }
    return ok;
  }

  /** Pushes a live notice (friend request, private message, table invite or join request) if it makes sense outside the app. */
  async notice(userId: string, n: LiveNotice): Promise<void> {
    const payload = pushTextOf(n);
    if (payload) await this.notify(userId, payload);
  }
}

const subBody = z.object({ endpoint: z.string().url().max(700), keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }) });

export function registerWebPushRoutes(app: FastifyInstance, auth: AuthService, push: WebPushService) {
  app.get('/push/config', async () => ({ publicKey: push.publicKey }));

  app.post('/push/subscribe', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const body = subBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    await push.subscribe(user.id, { endpoint: body.data.endpoint, p256dh: body.data.keys.p256dh, auth: body.data.keys.auth });
    return { ok: true };
  });

  app.post('/push/unsubscribe', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const body = z.object({ endpoint: z.string().max(700) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    await push.unsubscribe(body.data.endpoint);
    return { ok: true };
  });
}
