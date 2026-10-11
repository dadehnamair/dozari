import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { clientErrorInputSchema } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { ClientErrorStore } from './store.js';

/** One device may send this many reports per window: a crash loop must not fill the table. */
export const CLIENT_ERROR_WINDOW_MS = 10 * 60_000;
export const CLIENT_ERROR_PER_WINDOW = 8;

const idParam = z.object({ id: z.string().uuid() });

/**
 * Player side: `POST /client-errors` — the app's crash screen, a screen that failed to load or the «report a problem» button sends what happened with a screenshot.
 * It works signed-out too (a crash on the login screen is still a crash), so the caller is keyed by user or IP and rate limited.
 */
export function registerClientErrorRoutes(app: FastifyInstance, store: ClientErrorStore, auth?: AuthService, now: () => number = Date.now) {
  const seen = new Map<string, number[]>();
  app.post('/client-errors', { bodyLimit: 1_000_000 }, async (req, reply) => {
    const b = clientErrorInputSchema.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
    const user = auth ? await currentUser(auth, req) : null;
    const key = user?.id ?? req.ip;
    const t = now();
    const recent = (seen.get(key) ?? []).filter((x) => t - x < CLIENT_ERROR_WINDOW_MS);
    if (recent.length >= CLIENT_ERROR_PER_WINDOW) return reply.code(429).send({ error: 'limit' });
    seen.set(key, [...recent, t]);
    if (seen.size > 5000) for (const [k, v] of seen) if (v.every((x) => t - x >= CLIENT_ERROR_WINDOW_MS)) seen.delete(k);
    const id = await store.add(user?.id ?? null, b.data, t);
    return reply.code(201).send({ ok: true, id });
  });
}

/** Admin side: the list (newest first), one screenshot, and «checked». */
export function registerClientErrorAdminRoutes(guarded: FastifyInstance, store: ClientErrorStore, audit: (action: string, target: string, detail?: string) => void, now: () => number = Date.now) {
  guarded.get('/admin/client-errors', async () => ({ errors: await store.list(150), open: await store.openCount() }));
  guarded.get('/admin/client-errors/:id/screenshot', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    const shot = await store.screenshot(p.data.id);
    if (!shot) return reply.code(404).send({ error: 'not_found' });
    return { screenshot: shot };
  });
  guarded.post('/admin/client-errors/:id/resolve', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
    if (!(await store.resolve(p.data.id, now()))) return reply.code(404).send({ error: 'not_found' });
    audit('client_error.resolve', p.data.id);
    return { ok: true };
  });
}
