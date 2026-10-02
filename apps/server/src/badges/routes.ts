import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ModError } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { BadgeService } from './service.js';

const STATUS: Record<ModError, number> = { NOT_MODERATOR: 403, SELF: 400, PROTECTED: 403, NOT_FOUND: 404, LIMIT: 429, DURATION: 400, TEXT: 400 };

/** Player side: my badges, which one is shown, my notices; and the agent actions of «آجان دوزاری». */
export function registerBadgeRoutes(app: FastifyInstance, auth: AuthService, badges: BadgeService) {
  app.get('/me/badges', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return badges.me(user.id);
  });

  app.put('/me/badge', async (req, reply) => {
    const user = await currentUser(auth, req);
    const body = z.object({ badgeId: z.string().uuid().nullable() }).safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    return (await badges.equip(user.id, body.data.badgeId)) ? { ok: true } : reply.code(403).send({ error: 'not_owned' });
  });

  app.post('/me/notices/read', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    await badges.markNoticesRead(user.id);
    return { ok: true };
  });

  app.post('/mod/warn', async (req, reply) => {
    const user = await currentUser(auth, req);
    const body = z.object({ userId: z.string().uuid(), text: z.string().max(400) }).safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await badges.agentWarn(user.id, body.data.userId, body.data.text);
    return out.ok ? { ok: true } : reply.code(STATUS[out.error]).send({ error: out.error });
  });

  app.post('/mod/mute', async (req, reply) => {
    const user = await currentUser(auth, req);
    const body = z.object({ userId: z.string().uuid(), minutes: z.number().int().min(1).max(100_000), reason: z.string().max(300) }).safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await badges.agentMute(user.id, body.data.userId, body.data.minutes, body.data.reason);
    return out.ok ? { ok: true } : reply.code(STATUS[out.error]).send({ error: out.error });
  });
}
