import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { reportInputSchema, SUBMISSION_STATUSES, submissionInputSchema } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { FeedbackService } from './service.js';

const idParam = z.object({ id: z.string().uuid() });

/** Player side: report a player, suggest an item or a price, vote on suggestions. */
export function registerFeedbackRoutes(app: FastifyInstance, auth: AuthService, feedback: FeedbackService) {
  app.post('/reports', async (req, reply) => {
    const user = await currentUser(auth, req);
    const b = reportInputSchema.safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await feedback.report(user.id, b.data);
    if (out === 'ok') return reply.code(201).send({ ok: true });
    return reply.code(out === 'limit' ? 429 : out === 'duplicate' ? 409 : out === 'unknown_user' ? 404 : 400).send({ error: out });
  });

  app.post('/ugc/submissions', async (req, reply) => {
    const user = await currentUser(auth, req);
    const b = submissionInputSchema.safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await feedback.submit(user.id, b.data);
    if (out.ok) return reply.code(201).send({ id: out.id });
    return reply.code(out.error === 'limit' ? 429 : out.error === 'duplicate' ? 409 : out.error === 'unknown_product' ? 404 : 400).send({ error: out.error, ...(out.productId ? { productId: out.productId } : {}) });
  });

  app.get('/ugc/feed', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return feedback.feed(user.id);
  });

  app.post('/ugc/:id/vote', async (req, reply) => {
    const user = await currentUser(auth, req);
    const p = idParam.safeParse(req.params);
    const b = z.object({ value: z.union([z.literal(1), z.literal(-1)]) }).safeParse(req.body);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await feedback.vote(user.id, p.data.id, b.data.value);
    if (out.ok) return { ok: true };
    return reply.code(out.error === 'not_found' ? 404 : out.error === 'locked' ? 403 : 409).send({ error: out.error });
  });
}

/** Admin side: user reports and the suggestion queue. */
export function registerFeedbackAdminRoutes(guarded: FastifyInstance, feedback: FeedbackService, audit: (action: string, target: string, detail?: string) => void) {
  guarded.get('/admin/user-reports', async () => ({ reports: await feedback.reports(150) }));
  guarded.post('/admin/user-reports/:id/resolve', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    if (!(await feedback.resolveReport(p.data.id))) return reply.code(404).send({ error: 'report_not_found' });
    audit('user_report.resolve', p.data.id);
    return { ok: true };
  });

  guarded.get('/admin/ugc', async (req) => {
    const q = z.object({ status: z.enum(SUBMISSION_STATUSES).optional() }).safeParse(req.query);
    return { submissions: await feedback.list(q.success ? (q.data.status ?? null) : null, 150) };
  });
  guarded.post('/admin/ugc/:id/approve', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await feedback.approve(p.data.id);
    if (!out.ok) return reply.code(out.error === 'not_found' ? 404 : 409).send({ error: out.error });
    audit('ugc.approve', p.data.id, out.productId);
    return { ok: true, productId: out.productId ?? null };
  });
  guarded.post('/admin/ugc/:id/reject', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await feedback.reject(p.data.id);
    if (!out.ok) return reply.code(out.error === 'not_found' ? 404 : 409).send({ error: out.error });
    audit('ugc.reject', p.data.id);
    return { ok: true };
  });
}
