import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { TournamentError } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { TournamentService } from './service.js';

const idParam = z.object({ id: z.string().uuid() });
const STATUS: Record<TournamentError | 'INVALID', number> = { NOT_FOUND: 404, CLOSED: 409, FULL: 409, ALREADY_IN: 409, NOT_IN: 409, LEVEL: 403, COINS: 402, NOT_ACTIVATED: 403, BUSY: 409, BAD_STATE: 409, TOO_FEW: 409, INVALID: 400 };

/** Player side: the list, a tournament's own page, join and leave. */
export function registerTournamentRoutes(app: FastifyInstance, auth: AuthService, tournaments: TournamentService) {
  app.get('/tournaments', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return { tournaments: await tournaments.list(user.id) };
  });

  app.get('/tournaments/:id', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = idParam.safeParse(req.params);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    return (await tournaments.detail(user.id, p.data.id)) ?? reply.code(404).send({ error: 'NOT_FOUND' });
  });

  for (const action of ['join', 'leave'] as const) {
    app.post(`/tournaments/:id/${action}`, async (req, reply) => {
      const user = await currentUser(auth, req);
      const p = idParam.safeParse(req.params);
      if (!user) return reply.code(401).send({ error: 'unauthorized' });
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = action === 'join' ? await tournaments.join(user.id, p.data.id) : await tournaments.leave(user.id, p.data.id);
      return out.ok ? { ok: true, balance: out.balance } : reply.code(STATUS[out.error]).send({ error: out.error });
    });
  }
}
