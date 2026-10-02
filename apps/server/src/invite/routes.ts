import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { normalizeInviteCode, looksLikeInviteCode } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { InviteService } from './service.js';
import type { InviteStore } from './store.js';

/** Player side: my code and its rules, redeem someone's code. */
export function registerInviteRoutes(app: FastifyInstance, auth: AuthService, invite: InviteService) {
  app.get('/me/invite', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return invite.mine(user.id);
  });

  app.post('/invite/redeem', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const body = z.object({ code: z.string().max(40) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await invite.redeem(user.id, body.data.code);
    if (out.ok) return { bonus: out.bonus, balance: out.balance };
    return reply.code(out.error === 'rate_limited' ? 429 : out.error === 'invalid' ? 404 : 409).send({ error: out.error });
  });
}

/** Admin side (inside the guarded scope): list, create special codes, change limits or switch off. */
export function registerInviteAdminRoutes(guarded: FastifyInstance, store: InviteStore, audit: (action: string, target: string, detail?: string) => void) {
  guarded.get('/admin/invites', async () => ({ codes: await store.listCodes() }));

  guarded.post('/admin/invites', async (req, reply) => {
    const b = z.object({ code: z.string().max(20), label: z.string().trim().min(1).max(80), maxUses: z.number().int().min(1).max(1_000_000) }).safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
    const code = normalizeInviteCode(b.data.code);
    if (!looksLikeInviteCode(code)) return reply.code(400).send({ error: 'invalid_code' });
    if ((await store.createCode(code, null, b.data.label, b.data.maxUses)) === 'taken') return reply.code(409).send({ error: 'duplicate' });
    audit('invite.create', code, `${b.data.label} x${b.data.maxUses}`);
    return reply.code(201).send({ code });
  });

  guarded.patch('/admin/invites/:code', async (req, reply) => {
    const p = z.object({ code: z.string().max(20) }).safeParse(req.params);
    const b = z.object({ maxUses: z.number().int().min(1).max(1_000_000).optional(), isActive: z.boolean().optional() }).safeParse(req.body);
    if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
    if ((await store.updateCode(normalizeInviteCode(p.data.code), b.data)) === 'not_found') return reply.code(404).send({ error: 'code_not_found' });
    audit('invite.update', p.data.code, JSON.stringify(b.data));
    return { ok: true };
  });
}
