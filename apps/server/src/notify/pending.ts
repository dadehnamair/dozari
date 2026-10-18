import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PendingNotices } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import { RateLimiter } from '../security/rate-limit.js';
import { BALE_TEXT } from './texts.js';

const MAX_ITEMS = 20;

export interface PendingSources {
  /** Players who sent a friend request that is still waiting. */
  incomingRequests(userId: string): Promise<{ id: string; nickname: string }[]>;
}

/**
 * Pure part of the background check: the waiting friend requests. Inbox news is deliberately not announced (only things that need a
 * person are pushed outside the app). A friend request has no time of its own, so it is always listed and the device remembers it by id.
 */
export function buildPending(now: number, requests: Awaited<ReturnType<PendingSources['incomingRequests']>>): PendingNotices {
  const items: PendingNotices['items'] = requests.map((r) => ({ id: `fr:${r.id}`, kind: 'friend_request' as const, title: 'دوزاری', body: BALE_TEXT.friendRequest(r.nickname), at: now }));
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
    return buildPending(now(), await sources.incomingRequests(user.id));
  });
}
