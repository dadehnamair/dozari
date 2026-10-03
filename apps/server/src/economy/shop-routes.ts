import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { ShopService } from './shop.js';

const idParam = z.object({ id: z.string().uuid() });

/** Player side of the coin shop. */
export function registerShopRoutes(app: FastifyInstance, auth: AuthService, shop: ShopService) {
  app.get('/shop', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return shop.shop(user.id);
  });

  app.post('/shop/:id/buy', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = idParam.safeParse(req.params);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await shop.buy(user.id, p.data.id);
    if (out.ok) return { balance: out.balance, gems: out.gems, tokens: out.tokens };
    const code = out.error === 'unknown_item' || out.error === 'unavailable' ? 404 : out.error === 'insufficient' ? 402 : out.error === 'level' ? 403 : 409;
    return reply.code(code).send({ error: out.error, ...('minLevel' in out ? { minLevel: out.minLevel } : {}) });
  });
}
