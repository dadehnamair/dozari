import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { RateLimiter } from '../../security/rate-limit.js';
import type { AdminAccounts, AdminActor } from './service.js';
import { ROLES } from './permissions.js';

declare module 'fastify' {
  interface FastifyRequest {
    adminActor?: AdminActor;
  }
}

const idParam = z.object({ id: z.string().uuid() });
const ERR_STATUS = { DUPLICATE: 409, INVALID_USERNAME: 400, WEAK_PASSWORD: 400, NOT_FOUND: 404, LAST_OWNER: 409 } as const;

/** Sign-in (outside the token guard, with its own brute-force limit). */
export function registerAdminLogin(app: FastifyInstance, accounts: AdminAccounts) {
  const byIp = new RateLimiter(10, 15 * 60_000);
  app.post('/admin/login', async (req, reply) => {
    if (byIp.blocked(req.ip)) return reply.header('retry-after', String(byIp.retryAfterSec(req.ip))).code(429).send({ error: 'rate_limited' });
    const body = z.object({ username: z.string().max(60), password: z.string().max(200) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await accounts.login(body.data.username, body.data.password);
    if (!out.ok) {
      byIp.take(req.ip);
      return reply.code(out.error === 'locked' ? 423 : 401).send({ error: out.error === 'locked' ? 'account_locked' : 'invalid_credentials' });
    }
    return { token: out.token, admin: out.admin, permissions: accounts.permissions(out.admin.role) };
  });
}

/** Inside the guard: who am I, and (owner only) manage the admin accounts. Role checks happen in the guard (`permissionFor`). */
export function registerAdminAccountRoutes(g: FastifyInstance, accounts: AdminAccounts, audit: (action: string, target: string, detail?: string) => void) {
  g.get('/admin/me', async (req) => {
    const a = req.adminActor!;
    return { id: a.id, name: a.name, role: a.role, legacy: a.legacy, permissions: accounts.permissions(a.role) };
  });

  g.get('/admin/admins', async () => ({ admins: await accounts.list(), legacyToken: accounts.hasLegacyToken }));

  g.post('/admin/admins', async (req, reply) => {
    const b = z.object({ username: z.string().max(30), displayName: z.string().trim().min(1).max(60), password: z.string().max(200), role: z.enum(ROLES) }).safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await accounts.create(b.data);
    if (typeof out === 'string') return reply.code(ERR_STATUS[out]).send({ error: out.toLowerCase() });
    audit('admin.create', out.id, `${out.username} ${out.role}`);
    return reply.code(201).send(out);
  });

  g.put('/admin/admins/:id', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    const b = z.object({ displayName: z.string().trim().min(1).max(60).optional(), role: z.enum(ROLES).optional(), isActive: z.boolean().optional() }).safeParse(req.body);
    if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await accounts.update(p.data.id, b.data);
    if (typeof out === 'string') return reply.code(ERR_STATUS[out]).send({ error: out.toLowerCase() });
    audit('admin.update', p.data.id, JSON.stringify(b.data));
    return out;
  });

  g.post('/admin/admins/:id/password', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    const b = z.object({ password: z.string().max(200) }).safeParse(req.body);
    if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await accounts.setPassword(p.data.id, b.data.password);
    if (out !== 'ok') return reply.code(ERR_STATUS[out]).send({ error: out.toLowerCase() });
    audit('admin.password', p.data.id);
    return { ok: true };
  });
}
