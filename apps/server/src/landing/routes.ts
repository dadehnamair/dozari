import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { SettingsService } from '../settings/service.js';
import type { LandingService } from './service.js';

const link = (v: string): string | null => (/^https?:\/\//i.test(v.trim()) ? v.trim() : null);
/** A site-verification code: letters, digits, `-` and `_` only, so it can never break out of a meta tag. */
const token = (v: string): string | null => (/^[A-Za-z0-9_-]{4,100}$/.test(v.trim()) ? v.trim() : null);
const list = (v: string): string[] => v.split(/[,،\n]/).map((x) => x.trim()).filter((x) => x !== '');

/** Read-only content for the landing site (`apps/landing` fetches it server to server; it stays up in maintenance mode, see settings/gate.ts). */
export function registerLandingPublicRoutes(app: FastifyInstance, landing: LandingService, settings: SettingsService) {
  app.get('/public/landing', async () => {
    const t = (k: string) => settings.text(k);
    const [name, tagline, heroTitle, heroText, email, instagram, channel, android, appUrl, dApp, dLanding, dShort, seoTitle, seoDescription, keywords, ogImage, ogAlt, sameAs, fontUrl, vGoogle, vBing, vYandex, indexable, cast, faq] = await Promise.all([
      t('landing.site_name'), t('landing.tagline'), t('landing.hero_title'), t('landing.hero_text'), t('landing.contact_email'), t('link.instagram'), t('link.channel'), t('link.android_app'), t('link.app_url'),
      t('domain.app'), t('domain.landing'), t('domain.short'),
      t('landing.seo_title'), t('landing.seo_description'), t('landing.keywords'), t('landing.og_image'), t('landing.og_image_alt'), t('landing.same_as'), t('landing.font_url'),
      t('seo.verify_google'), t('seo.verify_bing'), t('seo.verify_yandex'), settings.num('landing.indexable'), landing.cast.publicList(), landing.faq.publicList(),
    ]);
    return {
      site: { name, tagline, heroTitle, heroText, contactEmail: email.trim() || null, instagram: link(instagram), channel: link(channel), androidApp: link(android), appUrl: link(appUrl), domains: { app: dApp.trim(), landing: dLanding.trim(), short: dShort.trim() },
        seo: {
          title: seoTitle.trim() || null, description: seoDescription.trim() || null, keywords: list(keywords), ogImage: link(ogImage), ogImageAlt: ogAlt.trim() || null,
          sameAs: list(sameAs).map(link).filter((x): x is string => x !== null), fontUrl: link(fontUrl), indexable: indexable !== 0,
          verify: { google: token(vGoogle), bing: token(vBing), yandex: token(vYandex) },
        },
      },
      cast: cast.map((c) => ({ id: c.id, name: c.nameFa, role: c.roleFa, bio: c.bioFa, image: c.imageKey })),
      faq: faq.map((f) => ({ question: f.questionFa, answer: f.answerFa })),
    };
  });

  app.get('/public/posts', async (req) => {
    const q = z.object({ page: z.coerce.number().int().min(1).max(10_000).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(12) }).parse(req.query);
    return landing.publicPosts(q.page, q.pageSize);
  });

  app.get('/public/posts/:slug', async (req, reply) => {
    const p = z.object({ slug: z.string().min(1).max(200) }).safeParse(req.params);
    const out = p.success ? await landing.publicPost(decodeURIComponent(p.data.slug)) : null;
    return out ?? reply.code(404).send({ error: 'not_found' });
  });
}

const postBody = z.object({
  titleFa: z.string().trim().min(2).max(160),
  summaryFa: z.string().trim().max(400).default(''),
  bodyMd: z.string().min(1).max(100_000),
  slug: z.string().trim().max(120).optional(),
  metaTitle: z.string().trim().max(70).nullable().optional(),
  metaDescription: z.string().trim().max(200).nullable().optional(),
  coverUrl: z.string().trim().max(300).nullable().optional(),
  authorName: z.string().trim().max(80).optional(),
  status: z.enum(['draft', 'published']),
});
const idParam = z.object({ id: z.string().uuid() });

/** Admin side: blog posts, cast and FAQ. */
export function registerLandingAdminRoutes(g: FastifyInstance, landing: LandingService, audit: (action: string, target: string, detail?: string) => void) {
  const status = (e: string) => (e === 'slug_taken' ? 409 : e === 'not_found' ? 404 : 400);

  g.get('/admin/landing/posts', async () => {
    const { rows, total } = await landing.adminPosts();
    return { total, posts: rows.map((p) => ({ id: p.id, slug: p.slug, titleFa: p.titleFa, status: p.status, publishedAt: p.publishedAt, updatedAt: p.updatedAt })) };
  });
  g.get('/admin/landing/posts/:id', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    const post = p.success ? await landing.adminPost(p.data.id) : null;
    return post ?? reply.code(404).send({ error: 'not_found' });
  });
  g.post('/admin/landing/posts', async (req, reply) => {
    const b = postBody.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await landing.savePost(b.data);
    if (!out.ok) return reply.code(status(out.error)).send({ error: out.error });
    audit('landing.post.create', out.id, `${out.slug} ${b.data.status}`);
    return reply.code(201).send({ id: out.id, slug: out.slug });
  });
  g.put('/admin/landing/posts/:id', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    const b = postBody.safeParse(req.body);
    if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await landing.savePost(b.data, p.data.id);
    if (!out.ok) return reply.code(status(out.error)).send({ error: out.error });
    audit('landing.post.update', out.id, `${out.slug} ${b.data.status}`);
    return { id: out.id, slug: out.slug };
  });

  const castBody = z.object({ nameFa: z.string().trim().min(1).max(80), roleFa: z.string().trim().max(120).default(''), bioFa: z.string().trim().min(1).max(2000), imageKey: z.string().trim().max(200).nullable().default(null), isActive: z.boolean().default(true) });
  g.get('/admin/landing/cast', async () => ({ cast: await landing.cast.list() }));
  g.post('/admin/landing/cast', async (req, reply) => {
    const b = castBody.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
    const row = await landing.cast.add(b.data);
    audit('landing.cast.add', row.id, b.data.nameFa);
    return reply.code(201).send({ id: row.id });
  });
  g.patch('/admin/landing/cast/:id', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    const b = castBody.partial().extend({ sortOrder: z.number().int().min(0).max(10_000).optional() }).safeParse(req.body);
    if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
    if ((await landing.cast.update(p.data.id, b.data)) === 'not_found') return reply.code(404).send({ error: 'not_found' });
    audit('landing.cast.update', p.data.id, JSON.stringify(b.data));
    return { ok: true };
  });

  const faqBody = z.object({ questionFa: z.string().trim().min(2).max(200), answerFa: z.string().trim().min(2).max(4000), isActive: z.boolean().default(true) });
  g.get('/admin/landing/faq', async () => ({ faq: await landing.faq.list() }));
  g.post('/admin/landing/faq', async (req, reply) => {
    const b = faqBody.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
    const row = await landing.faq.add(b.data);
    audit('landing.faq.add', row.id, b.data.questionFa);
    return reply.code(201).send({ id: row.id });
  });
  g.patch('/admin/landing/faq/:id', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    const b = faqBody.partial().extend({ sortOrder: z.number().int().min(0).max(10_000).optional() }).safeParse(req.body);
    if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
    if ((await landing.faq.update(p.data.id, b.data)) === 'not_found') return reply.code(404).send({ error: 'not_found' });
    audit('landing.faq.update', p.data.id, JSON.stringify(b.data));
    return { ok: true };
  });
}
