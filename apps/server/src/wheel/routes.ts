import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { WheelService } from './service.js';

/** Player side: the spins a win earned and the spin itself. */
export function registerWheelRoutes(app: FastifyInstance, auth: AuthService, wheel: WheelService) {
  app.get('/wheel', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return wheel.status(user.id);
  });

  app.post('/wheel/spin', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const out = await wheel.spin(user.id);
    if (!out) return reply.code(409).send({ error: 'NO_SPIN' });
    return { ok: true as const, ...out };
  });
}
