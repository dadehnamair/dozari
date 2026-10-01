import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { MessageCenter } from './service.js';

const idParam = z.object({ id: z.string().uuid() });

/** Player side: the in-app inbox filled by the admin message center. */
export function registerInboxRoutes(app: FastifyInstance, auth: AuthService, center: MessageCenter) {
  app.get('/inbox', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const [items, unread] = await Promise.all([center.inbox(user.id), center.unread(user.id)]);
    return { unread, items };
  });

  app.post('/inbox/read-all', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    await center.markAllRead(user.id);
    return { ok: true };
  });

  app.post('/inbox/:id/read', async (req, reply) => {
    const user = await currentUser(auth, req);
    const params = idParam.safeParse(req.params);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!params.success) return reply.code(400).send({ error: 'invalid_request' });
    return (await center.markRead(user.id, params.data.id)) ? { ok: true } : reply.code(404).send({ error: 'not_found' });
  });
}
