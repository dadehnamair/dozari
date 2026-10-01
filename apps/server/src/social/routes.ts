import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { genderSchema } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import { RateLimiter } from '../security/rate-limit.js';
import type { SocialService } from './service.js';

const idParam = z.object({ id: z.string().uuid() });

/** Player side: public profiles, friend requests, own profile and gender (D67, D68). */
export function registerSocialRoutes(app: FastifyInstance, auth: AuthService, social: SocialService) {
  // Friend-request spam: 30 requests an hour per player.
  const requestLimit = new RateLimiter(30, 60 * 60_000);
  app.get('/me/profile', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return (await social.mine(user.id)) ?? reply.code(404).send({ error: 'not_found' });
  });

  app.put('/me/gender', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const body = z.object({ gender: genderSchema.nullable() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    await social.setGender(user.id, body.data.gender);
    return { gender: body.data.gender };
  });

  app.get('/players/:id', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = idParam.safeParse(req.params);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    return (await social.profile(user.id, p.data.id)) ?? reply.code(404).send({ error: 'player_not_found' });
  });

  app.get('/friends', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return social.friends(user.id);
  });

  app.post('/friends/:id/request', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = idParam.safeParse(req.params);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    if (!requestLimit.take(user.id)) return reply.header('retry-after', String(requestLimit.retryAfterSec(user.id))).code(429).send({ error: 'rate_limited' });
    const out = await social.request(user.id, p.data.id);
    if (out === 'unknown_player') return reply.code(404).send({ error: 'player_not_found' });
    if (out === 'self') return reply.code(400).send({ error: 'cannot_friend_self' });
    if (out === 'already') return reply.code(409).send({ error: 'already' });
    return { status: out === 'accepted' ? 'friends' : 'sent' };
  });

  app.post('/friends/:id/accept', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = idParam.safeParse(req.params);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    return (await social.accept(user.id, p.data.id)) ? { status: 'friends' } : reply.code(404).send({ error: 'no_request' });
  });

  app.delete('/friends/:id', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = idParam.safeParse(req.params);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    return (await social.remove(user.id, p.data.id)) ? { status: 'none' } : reply.code(404).send({ error: 'no_relation' });
  });
}
