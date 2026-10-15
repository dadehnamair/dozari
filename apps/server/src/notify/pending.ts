import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PendingNotices } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import { RateLimiter } from '../security/rate-limit.js';
import { BALE_TEXT } from './texts.js';

const MAX_ITEMS = 20;
/** Messages older than this are never announced by a background check (a phone off for weeks would otherwise buzz with old news). */
export const PENDING_WINDOW_MS = 3 * 86_400_000;

export interface PendingSources {
  /** Unread inbox messages, newest first. */
  inbox(userId: string): Promise<{ id: string; title: string; body: string; createdAt: number; read: boolean }[]>;
  /** Players who sent a friend request that is still waiting. */
  incomingRequests(userId: string): Promise<{ id: string; nickname: string }[]>;
}

/**
 * Pure part of the background check: unread inbox messages newer than `after` (and inside the window), plus waiting friend
 * requests. A friend request has no time of its own, so it is always listed and the device remembers it by id.
 */
export function buildPending(now: number, after: number, inbox: Awaited<ReturnType<PendingSources['inbox']>>, requests: Awaited<ReturnType<PendingSources['incomingRequests']>>): PendingNotices {
  const floor = Math.max(after, now - PENDING_WINDOW_MS);
  const items: PendingNotices['items'] = [
    ...requests.map((r) => ({ id: `fr:${r.id}`, kind: 'friend_request' as const, title: 'دوزاری', body: BALE_TEXT.friendRequest(r.nickname), at: now })),
    ...inbox.filter((m) => !m.read && m.createdAt > floor).map((m) => ({ id: `in:${m.id}`, kind: 'inbox' as const, title: m.title.slice(0, 200), body: m.body.slice(0, 500), at: m.createdAt })),
  ];
  return { now, items: items.slice(0, MAX_ITEMS) };
}

const query = z.object({ after: z.coerce.number().int().nonnegative().default(0) });
/** At most one check per 5 minutes per player is the normal rhythm; 20 per hour leaves room for retries without becoming a hammer. */
const limiter = new RateLimiter(20, 3_600_000);

export function registerPendingRoutes(app: FastifyInstance, auth: AuthService, sources: PendingSources, now: () => number = Date.now) {
  app.get('/me/pending-notices', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const q = query.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'invalid_request' });
    if (!limiter.take(user.id)) return reply.header('retry-after', String(limiter.retryAfterSec(user.id))).code(429).send({ error: 'rate_limited' });
    const [inbox, requests] = await Promise.all([sources.inbox(user.id), sources.incomingRequests(user.id)]);
    return buildPending(now(), q.data.after, inbox, requests);
  });
}
