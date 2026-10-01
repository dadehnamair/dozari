import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { TransferError } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import { RateLimiter } from '../security/rate-limit.js';
import type { TransferService } from './service.js';

const idParam = z.object({ id: z.string().uuid() });
const amountBody = z.object({ amount: z.number().int().min(1).max(1_000_000) });

const STATUS: Record<TransferError, number> = {
  OFF: 403, NOT_ACTIVATED: 403, LEVEL: 403, NOT_FRIENDS: 403, TOO_NEW: 403, AMOUNT: 400, CAP: 409, INSUFFICIENT: 402,
  LOAN_LIMIT: 409, OVERDUE: 409, NOT_FOUND: 404, LENDER_SHORT: 409, BAD_STATE: 409,
};

/** Player side of gifts and loans between friends. */
export function registerTransferRoutes(app: FastifyInstance, auth: AuthService, transfers: TransferService) {
  // A burst of transfer requests is a sign of a script, not a friend: 30 per hour per player.
  const limit = new RateLimiter(30, 60 * 60_000);
  const fail = (reply: FastifyReply, error: TransferError) => reply.code(STATUS[error]).send({ error });

  app.get('/transfers/rules', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return transfers.info(user.id);
  });

  app.get('/transfers', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return { transfers: await transfers.list(user.id) };
  });

  const send = (kind: 'gift' | 'loan') => async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await currentUser(auth, req);
    const p = idParam.safeParse(req.params);
    const b = amountBody.safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
    if (!limit.take(user.id)) return reply.header('retry-after', String(limit.retryAfterSec(user.id))).code(429).send({ error: 'rate_limited' });
    const out = kind === 'gift' ? await transfers.gift(user.id, p.data.id, b.data.amount) : await transfers.offerLoan(user.id, p.data.id, b.data.amount);
    return out.ok ? { ok: true, id: out.id ?? null } : fail(reply, out.error);
  };
  app.post('/friends/:id/gift', send('gift'));
  app.post('/friends/:id/loan', send('loan'));

  app.post('/loans/:id/accept', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = idParam.safeParse(req.params);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await transfers.acceptLoan(user.id, p.data.id);
    return out.ok ? { ok: true, balance: out.balance } : fail(reply, out.error);
  });

  for (const [path, as] of [['decline', 'declined'], ['cancel', 'cancelled']] as const) {
    app.post(`/loans/:id/${path}`, async (req, reply) => {
      const user = await currentUser(auth, req);
      const p = idParam.safeParse(req.params);
      if (!user) return reply.code(401).send({ error: 'unauthorized' });
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await transfers.closeOffer(user.id, p.data.id, as);
      return out.ok ? { ok: true } : fail(reply, out.error);
    });
  }

  app.post('/loans/:id/repay', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = idParam.safeParse(req.params);
    const b = amountBody.safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await transfers.repay(user.id, p.data.id, b.data.amount);
    return out.ok ? { paid: out.paid, remaining: out.remaining, balance: out.balance } : fail(reply, out.error);
  });
}
