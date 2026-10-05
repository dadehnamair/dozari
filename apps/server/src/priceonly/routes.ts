import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { PriceOnlyService } from './service.js';

const paramsSchema = z.object({ id: z.string().uuid() });
const guessSchema = z.object({ index: z.number().int().min(0).max(20), guessRials: z.string().regex(/^\d{1,15}$/) });

/** Price-only mode (`/price-only/*`): the player sees questions, never a real price before answering that round. */
export function registerPriceOnlyRoutes(app: FastifyInstance, svc: PriceOnlyService, auth?: AuthService) {
  app.post('/price-only/start', async (req, reply) => {
    const user = auth ? await currentUser(auth, req) : null;
    const view = await svc.start(user?.id);
    if (!view) return reply.code(503).send({ error: 'no_products' });
    return view;
  });

  app.get('/price-only/:id', async (req, reply) => {
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_id' });
    const view = svc.view(params.data.id);
    if (!view) return reply.code(404).send({ error: 'session_not_found' });
    return view;
  });

  app.post('/price-only/:id/guess', async (req, reply) => {
    const params = paramsSchema.safeParse(req.params);
    const body = guessSchema.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'invalid_request' });
    const guess = BigInt(body.data.guessRials);
    if (guess <= 0n) return reply.code(400).send({ error: 'invalid_request' });
    const out = svc.guess(params.data.id, body.data.index, guess);
    if (out === null) return reply.code(404).send({ error: 'session_not_found' });
    if (out === 'unknown_round') return reply.code(404).send({ error: 'unknown_round' });
    return out;
  });
}
