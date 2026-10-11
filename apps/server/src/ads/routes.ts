import type { FastifyInstance } from 'fastify';
import { adCompleteBodySchema, adStartBodySchema } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { AdsService } from './service.js';

/** Player side of the rewarded ads (adult track only: the request gate refuses `/ads` for kid and teen). */
export function registerAdsRoutes(app: FastifyInstance, auth: AuthService, ads: AdsService) {
  app.get('/ads', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return ads.status(user.id);
  });

  app.post('/ads/start', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const body = adStartBodySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
    const out = await ads.start(user.id, body.data.placement);
    if (!out.ok) return reply.code(out.error === 'disabled' ? 404 : 409).send({ error: out.error });
    return { viewId: out.viewId, minWatchSeconds: out.minWatchSeconds };
  });

  app.post('/ads/complete', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const body = adCompleteBodySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
    const out = await ads.complete(user.id, body.data.viewId, body.data.proof);
    if (!out.ok) return reply.code(out.error === 'not_found' ? 404 : 409).send({ error: out.error });
    return { ok: true as const, ...out.paid };
  });
}
