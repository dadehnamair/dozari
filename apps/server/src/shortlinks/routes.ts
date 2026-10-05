import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { cleanTarget } from './service.js';
import type { ShortLinkService } from './service.js';

/** `GET /s/:code` redirects on any host (handy before the short domain points here). Unknown or switched-off codes answer a real 404. */
export function registerShortLinkRoutes(app: FastifyInstance, links: ShortLinkService) {
  app.get('/s/:code', async (req, reply) => {
    const p = z.object({ code: z.string().max(40) }).safeParse(req.params);
    const target = p.success ? await links.resolve(p.data.code) : null;
    if (!target) return reply.code(404).send({ error: 'not_found' });
    return reply.header('cache-control', 'no-store').redirect(target, 302);
  });
}

/**
 * The short domain itself: a request whose Host is the admin's `domain.short` is answered here before anything else.
 * `/` goes to the landing site (or the app), `/<code>` to the target, anything else is a 404.
 */
export async function handleShortHost(links: ShortLinkService, path: string, home: string | null): Promise<{ status: 302 | 404; location?: string }> {
  if (path === '/' || path === '') return home ? { status: 302, location: home } : { status: 404 };
  const target = await links.resolve(path.replace(/^\//, '').replace(/\/$/, ''));
  return target ? { status: 302, location: target } : { status: 404 };
}

/** Admin side: list, create, edit, switch off. */
export function registerShortLinkAdminRoutes(guarded: FastifyInstance, links: ShortLinkService, base: () => Promise<string>, audit: (action: string, target: string, detail?: string) => void) {
  guarded.get('/admin/short-links', async () => ({ base: await base(), links: await links.admin.list() }));

  guarded.post('/admin/short-links', async (req, reply) => {
    const b = z.object({ url: z.string().max(1000), code: z.string().max(24).optional(), note: z.string().trim().max(120).default('') }).safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await links.create(b.data.url, b.data.code, b.data.note);
    if (!out.ok) return reply.code(out.error === 'taken' ? 409 : 400).send({ error: out.error });
    audit('shortlink.create', out.code, b.data.url);
    return reply.code(201).send({ code: out.code });
  });

  guarded.patch('/admin/short-links/:code', async (req, reply) => {
    const p = z.object({ code: z.string().max(24) }).safeParse(req.params);
    const b = z.object({ url: z.string().max(1000).optional(), note: z.string().trim().max(120).optional(), isActive: z.boolean().optional() }).safeParse(req.body);
    if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
    const patch: { targetUrl?: string; note?: string; isActive?: boolean } = {};
    if (b.data.url !== undefined) {
      const t = cleanTarget(b.data.url);
      if (!t) return reply.code(400).send({ error: 'invalid_url' });
      patch.targetUrl = t;
    }
    if (b.data.note !== undefined) patch.note = b.data.note;
    if (b.data.isActive !== undefined) patch.isActive = b.data.isActive;
    if ((await links.admin.update(p.data.code, patch)) === 'not_found') return reply.code(404).send({ error: 'link_not_found' });
    audit('shortlink.update', p.data.code, JSON.stringify(b.data));
    return { ok: true };
  });
}
