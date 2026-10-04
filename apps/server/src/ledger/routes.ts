import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { LedgerReader } from './store.js';

const query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30), before: z.string().max(80).optional() });

const encode = (r: { createdAt: number; id: string }) => `${r.createdAt}_${r.id}`;
function decode(cursor: string): { createdAt: number; id: string } | null {
  const [t, id] = cursor.split('_');
  const createdAt = Number(t);
  return id && Number.isSafeInteger(createdAt) ? { createdAt, id } : null;
}

/** Player side: «تاریخچه‌ی سکه» — only the caller's own ledger rows, never anyone else's. */
export function registerLedgerRoutes(app: FastifyInstance, auth: AuthService, ledger: LedgerReader) {
  app.get('/me/ledger', async (req, reply) => {
    const user = await currentUser(auth, req);
    const q = query.safeParse(req.query);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!q.success) return reply.code(400).send({ error: 'invalid_request' });
    const before = q.data.before ? decode(q.data.before) : null;
    if (q.data.before && !before) return reply.code(400).send({ error: 'invalid_request' });
    const rows = await ledger.page(user.id, q.data.limit + 1, before);
    const items = rows.slice(0, q.data.limit);
    const last = items[items.length - 1];
    return { balance: await ledger.balance(user.id), items, next: rows.length > q.data.limit && last ? encode(last) : null };
  });
}
