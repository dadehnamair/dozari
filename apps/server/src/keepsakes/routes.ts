import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { showcaseBodySchema } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { KeepsakeService } from './service.js';

const idParam = z.object({ id: z.string().uuid() });
const STATUS = { unknown: 404, complete: 409, duplicate: 409, insufficient: 402, not_complete: 409, max: 409 } as const;

/** `GET /keepsakes`, `POST /keepsakes/:id/piece` (buy), `POST /keepsakes/:id/upgrade`, `PUT /me/showcase`, `GET /players/:id/showcase`. */
export function registerKeepsakeRoutes(app: FastifyInstance, auth: AuthService, keepsakes: KeepsakeService): void {
  app.get('/keepsakes', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return keepsakes.gallery(user.id);
  });

  app.post('/keepsakes/:id/piece', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = idParam.safeParse(req.params);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await keepsakes.buyPiece(user.id, p.data.id);
    if (out.ok) return out;
    return reply.code(out.error === 'off' ? 404 : STATUS[out.error]).send({ error: out.error });
  });

  app.post('/keepsakes/:id/upgrade', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = idParam.safeParse(req.params);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await keepsakes.upgrade(user.id, p.data.id);
    return out.ok ? out : reply.code(STATUS[out.error]).send({ error: out.error });
  });

  app.put('/me/showcase', async (req, reply) => {
    const user = await currentUser(auth, req);
    const body = showcaseBodySchema.safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    if (!(await keepsakes.setShowcase(user.id, body.data.ids))) return reply.code(400).send({ error: 'invalid_showcase' });
    return keepsakes.showcase(user.id);
  });

  app.get('/players/:id/showcase', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = idParam.safeParse(req.params);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    return keepsakes.showcase(p.data.id);
  });
}
