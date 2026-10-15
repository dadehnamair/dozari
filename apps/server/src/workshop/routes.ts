import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { WORKSHOP_REJECT_REASONS, WORKSHOP_STATUSES, workshopReviewSchema, workshopSubmitSchema } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { WorkshopService } from './service.js';

const idParam = z.object({ id: z.string().uuid() });

/**
 * Player side of the question workshop (docs/logic/question-workshop.md). `allowed` says whether the player's age track may use it
 * (adult only for now); `off` answers 403 so the app can hide the card.
 */
export function registerWorkshopRoutes(app: FastifyInstance, auth: AuthService, svc: WorkshopService, allowed?: (userId: string) => Promise<boolean>) {
  const who = async (req: Parameters<typeof currentUser>[1], reply: { code: (n: number) => { send: (b: unknown) => unknown } }) => {
    const user = await currentUser(auth, req);
    if (!user) {
      reply.code(401).send({ error: 'unauthorized' });
      return null;
    }
    if (allowed && !(await allowed(user.id).catch(() => false))) {
      reply.code(403).send({ error: 'not_for_track' });
      return null;
    }
    return user;
  };

  app.get('/workshop', async (req, reply) => {
    const user = await who(req, reply);
    return user ? svc.info(user.id) : undefined;
  });
  app.get('/workshop/topics', async (req, reply) => {
    const user = await who(req, reply);
    return user ? { topics: await svc.topics() } : undefined;
  });
  app.get('/workshop/mine', async (req, reply) => {
    const user = await who(req, reply);
    return user ? { submissions: await svc.mine(user.id) } : undefined;
  });
  app.get('/workshop/top', async (req, reply) => {
    const user = await who(req, reply);
    if (!user) return undefined;
    const q = z.object({ period: z.enum(['week', 'all']).default('week') }).safeParse(req.query);
    return svc.top(user.id, q.success ? q.data.period : 'week');
  });

  app.post('/workshop/submissions', async (req, reply) => {
    const user = await who(req, reply);
    if (!user) return undefined;
    const b = workshopSubmitSchema.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await svc.submit(user.id, b.data);
    if (out.ok) return reply.code(201).send({ id: out.id });
    return reply.code(out.error === 'limit' ? 429 : out.error === 'duplicate' ? 409 : out.error === 'off' ? 403 : 400).send({ error: out.error });
  });

  app.get('/workshop/review', async (req, reply) => {
    const user = await who(req, reply);
    return user ? svc.feed(user.id) : undefined;
  });
  app.post('/workshop/review/:id', async (req, reply) => {
    const user = await who(req, reply);
    if (!user) return undefined;
    const p = idParam.safeParse(req.params);
    const b = workshopReviewSchema.safeParse(req.body);
    if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await svc.review(user.id, p.data.id, b.data);
    if (out.ok) return out;
    return reply.code(out.error === 'not_found' ? 404 : out.error === 'locked' || out.error === 'off' ? 403 : out.error === 'daily_limit' ? 429 : 409).send({ error: out.error });
  });
}

/** Admin side: the queue (sorted by score), approve (optionally with edits) and reject with a reason. */
export function registerWorkshopAdminRoutes(guarded: FastifyInstance, svc: WorkshopService, audit: (action: string, target: string, detail?: string) => void) {
  guarded.get('/admin/workshop', async (req) => {
    const q = z.object({ status: z.enum(WORKSHOP_STATUSES).optional() }).safeParse(req.query);
    return { submissions: await svc.list(q.success ? (q.data.status ?? null) : null) };
  });
  guarded.post('/admin/workshop/:id/approve', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    const b = z.object({ edit: workshopSubmitSchema.optional() }).safeParse(req.body ?? {});
    if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await svc.approve(p.data.id, b.data.edit);
    if (!out.ok) return reply.code(out.error === 'not_found' ? 404 : out.error === 'closed' ? 409 : 400).send({ error: out.error });
    audit('workshop.approve', p.data.id, `${out.reward?.total ?? 0}`);
    return { ok: true, questionId: out.questionId ?? null, reward: out.reward ?? null };
  });
  guarded.post('/admin/workshop/:id/reject', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    const b = z.object({ reason: z.enum(WORKSHOP_REJECT_REASONS) }).safeParse(req.body);
    if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await svc.reject(p.data.id, b.data.reason);
    if (!out.ok) return reply.code(out.error === 'not_found' ? 404 : 409).send({ error: out.error });
    audit('workshop.reject', p.data.id, b.data.reason);
    return { ok: true };
  });
}
