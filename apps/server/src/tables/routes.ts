import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createTableBodySchema } from '@dozari/shared';
import type { TableError } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { TableService } from './service.js';

const STATUS: Record<TableError, number> = { NOT_FOUND: 404, FULL: 409, LOCKED: 403, EXPIRED: 410, NOT_HOST: 403, NOT_IN: 409, NOT_READY: 409, NEED_PLAYERS: 409, BUSY: 503, IN_MATCH: 409, START_FAILED: 409, INVALID: 400 };
const codeParam = z.object({ code: z.string().min(3).max(12) });
const targetBody = z.object({ userId: z.string().uuid() });

/** Player side of private tables. Polling `GET /tables/:code` keeps the screen current; the match itself starts through the socket (`match:found`). */
export function registerTableRoutes(app: FastifyInstance, auth: AuthService, tables: TableService, share?: (userId: string, code: string, label: string) => Promise<{ ok: true } | { ok: false; error: string }>) {
  const fail = (reply: FastifyReply, error: TableError) => reply.code(STATUS[error]).send({ error });

  app.post('/tables', async (req, reply) => {
    const user = await currentUser(auth, req);
    const b = createTableBodySchema.safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!b.success) return fail(reply, 'INVALID');
    const out = await tables.create(user.id, b.data);
    return out.ok ? reply.code(201).send(out.table) : fail(reply, out.error);
  });

  app.get('/tables/mine', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return { table: await tables.mine(user.id) };
  });

  app.get('/tables/:code', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = codeParam.safeParse(req.params);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success) return fail(reply, 'INVALID');
    return (await tables.get(user.id, p.data.code)) ?? fail(reply, 'NOT_FOUND');
  });

  app.post('/tables/:code/join', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = codeParam.safeParse(req.params);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success) return fail(reply, 'INVALID');
    const out = await tables.join(user.id, p.data.code);
    return out.ok ? out.table : fail(reply, out.error);
  });

  // The host posts the table into the city chat as a join card.
  app.post('/tables/share', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const t = await tables.mine(user.id);
    if (!t || !t.youAreHost) return fail(reply, 'NOT_HOST');
    if (!share) return reply.code(503).send({ error: 'OFF' });
    const out = await share(user.id, t.code, `${t.icon}|${t.name}`);
    return out.ok ? { ok: true } : reply.code(out.error === 'RATE_LIMITED' ? 429 : out.error === 'MUTED' ? 403 : out.error === 'NO_CITY' ? 409 : 400).send({ error: out.error });
  });

  // Actions on the table the caller sits at.
  const simple = (path: string, run: (userId: string, body: unknown) => Promise<{ ok: true } | { ok: false; error: TableError }> | { ok: true } | { ok: false; error: TableError }) =>
    app.post(`/tables/${path}`, async (req, reply) => {
      const user = await currentUser(auth, req);
      if (!user) return reply.code(401).send({ error: 'unauthorized' });
      const out = await run(user.id, req.body);
      return out.ok ? { ok: true } : fail(reply, out.error);
    });
  simple('leave', (u) => tables.leave(u));
  simple('start', (u) => tables.start(u));
  simple('ready', (u, b) => tables.setReady(u, z.object({ ready: z.boolean() }).safeParse(b).data?.ready ?? true));
  simple('lock', (u, b) => tables.setLocked(u, z.object({ locked: z.boolean() }).safeParse(b).data?.locked ?? true));
  simple('extend', async (u) => {
    const out = await tables.extend(u);
    return out.ok ? { ok: true } : out;
  });
  simple('kick', (u, b) => {
    const t = targetBody.safeParse(b);
    return t.success ? tables.kick(u, t.data.userId) : { ok: false, error: 'INVALID' };
  });
}
