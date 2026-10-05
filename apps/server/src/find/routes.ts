import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { FindService } from './service.js';

/** Player side: my public ID and invite link, search by ID or phone, find friends in the address book, friend via a link. */
export function registerFindRoutes(app: FastifyInstance, auth: AuthService, find: FindService) {
  app.get('/me/find', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return find.me(user.id);
  });

  app.put('/me/find', async (req, reply) => {
    const user = await currentUser(auth, req);
    const body = z.object({ findableByPhone: z.boolean() }).safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    await find.setFindable(user.id, body.data.findableByPhone);
    return find.me(user.id);
  });

  app.get('/players/search', async (req, reply) => {
    const user = await currentUser(auth, req);
    const q = z.object({ q: z.string().min(1).max(40) }).safeParse(req.query);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!q.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await find.search(user.id, q.data.q);
    return out === 'rate_limited' ? reply.code(429).send({ error: 'rate_limited' }) : out;
  });

  app.post('/friends/find-contacts', async (req, reply) => {
    const user = await currentUser(auth, req);
    const body = z.object({ phones: z.array(z.string().max(30)).max(500) }).safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await find.contacts(user.id, body.data.phones);
    return out === 'rate_limited' ? reply.code(429).send({ error: 'rate_limited' }) : out;
  });

  app.post('/friends/link', async (req, reply) => {
    const user = await currentUser(auth, req);
    const body = z.object({ handle: z.string().min(1).max(20) }).safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await find.friendByLink(user.id, body.data.handle);
    if (out === 'unknown') return reply.code(404).send({ error: 'player_not_found' });
    if (out === 'self') return reply.code(400).send({ error: 'cannot_friend_self' });
    if (out === 'limit') return reply.code(429).send({ error: 'rate_limited' });
    if (out === 'needs_guardian') return reply.code(403).send({ error: 'needs_guardian' });
    return { status: out };
  });
}
