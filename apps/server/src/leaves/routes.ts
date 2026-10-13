import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { LeaveService } from './service.js';

/** `GET /me/leave-status`: leaves so far today and how many remain before the day ban (the warning shown before leaving a match). */
export function registerLeaveRoutes(app: FastifyInstance, svc: LeaveService, auth: AuthService) {
  app.get('/me/leave-status', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return svc.warning(user.id);
  });
}
