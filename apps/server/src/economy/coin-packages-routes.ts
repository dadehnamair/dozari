import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { CoinPackageService } from './coin-packages.js';

const idParam = z.object({ id: z.string().uuid() });
const redeemBody = z.object({ store: z.enum(['bazaar', 'myket']), orderId: z.string().trim().min(3).max(120), token: z.string().min(3).max(4000) });

/** Player side of coin packages. The gate turns the whole prefix off while `feature.coin_packages` is 0. */
export function registerCoinPackageRoutes(app: FastifyInstance, auth: AuthService, service: CoinPackageService) {
  app.get('/coin-packages', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return { packages: await service.list(user.id) };
  });

  app.post('/coin-packages/:id/redeem', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = idParam.safeParse(req.params);
    const b = redeemBody.safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await service.redeem(user.id, p.data.id, b.data);
    if (out.ok) return { balance: out.balance, coins: out.coins, duplicate: out.duplicate };
    const code = out.error === 'unknown_package' ? 404 : out.error === 'level' ? 403 : out.error === 'not_verified' ? 402 : 409;
    return reply.code(code).send({ error: out.error, ...(out.minLevel ? { minLevel: out.minLevel } : {}) });
  });
}
