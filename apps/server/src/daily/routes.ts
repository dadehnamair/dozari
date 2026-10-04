import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { DailyService } from './service.js';

/** Player side: today's card and the one attempt. The game itself then runs on the ordinary `/solo/:id` routes. */
export function registerDailyRoutes(app: FastifyInstance, auth: AuthService, daily: DailyService) {
  app.get('/daily-puzzle', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return daily.status(user.id);
  });

  app.post('/daily-puzzle/start', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const out = await daily.start(user.id);
    if (!out.ok) return reply.code(out.error === 'done' ? 409 : 503).send({ error: out.error });
    return out.view;
  });
}
