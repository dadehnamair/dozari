import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { GROUP_SIZE } from '@dozari/shared';
import type { SoloService } from './service.js';

const paramsSchema = z.object({ id: z.string().uuid() });
const guessSchema = z.object({ productIds: z.array(z.string().min(1).max(64)).length(GROUP_SIZE) });

/** Solo practice (no coins): the client only ever receives `SoloView`, never the solution. */
export function registerSoloRoutes(app: FastifyInstance, solo: SoloService) {
  app.post('/solo/start', async (_req, reply) => {
    const view = await solo.start();
    if (!view) return reply.code(503).send({ error: 'no_puzzles' });
    return view;
  });

  app.get('/solo/:id', async (req, reply) => {
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_id' });
    const view = solo.view(params.data.id);
    if (!view) return reply.code(404).send({ error: 'session_not_found' });
    return view;
  });

  app.post('/solo/:id/guess', async (req, reply) => {
    const params = paramsSchema.safeParse(req.params);
    const body = guessSchema.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'invalid_request' });
    const result = solo.guess(params.data.id, body.data.productIds);
    if (!result) return reply.code(404).send({ error: 'session_not_found' });
    return result;
  });

  app.post('/solo/:id/shuffle', async (req, reply) => {
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_id' });
    const view = solo.shuffle(params.data.id);
    if (!view) return reply.code(404).send({ error: 'session_not_found' });
    return view;
  });
}
