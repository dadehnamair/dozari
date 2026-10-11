import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { RateLimiter } from '../security/rate-limit.js';
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
    const badgeIds = ['enamad', 'samandehi', 'ersa', 'etehadieh', 'ircg', 'bazaar', 'myket'] as const;
    const badgeUrls = await Promise.all(badgeIds.map((b) => t(`link.badge_${b}`)));
    const [name, tagline, heroTitle, heroText, email, instagram, channel, android, ios, baleBot, telegramApp, telegramOn, appUrl, dApp, dLanding, dShort, seoTitle, seoDescription, keywords, ogImage, ogAlt, sameAs, fontUrl, vGoogle, vBing, vYandex, vEnamad, indexable, statsUrl, statsId, cast, faq] = await Promise.all([
      t('landing.site_name'), t('landing.tagline'), t('landing.hero_title'), t('landing.hero_text'), t('landing.contact_email'), t('link.instagram'), t('link.channel'), t('link.android_app'), t('link.ios_app'), t('link.bale_bot'), t('link.telegram_app'), settings.num('feature.telegram_app'), t('link.app_url'),
      t('domain.app'), t('domain.landing'), t('domain.short'),
      t('landing.seo_title'), t('landing.seo_description'), t('landing.keywords'), t('landing.og_image'), t('landing.og_image_alt'), t('landing.same_as'), t('landing.font_url'),
      t('seo.verify_google'), t('seo.verify_bing'), t('seo.verify_yandex'), t('seo.verify_enamad'), settings.num('landing.indexable'), t('analytics.script_url'), t('analytics.site_id'), landing.cast.publicList(), landing.faq.publicList(),
    ]);
    return {
      site: { name, tagline, heroTitle, heroText, contactEmail: email.trim() || null, instagram: link(instagram), channel: link(channel), androidApp: link(android), iosApp: link(ios), baleBot: link(baleBot), telegramApp: telegramOn === 1 ? link(telegramApp) : null, appUrl: link(appUrl), domains: { app: dApp.trim(), landing: dLanding.trim(), short: dShort.trim() },
        badges: badgeIds.map((id, n) => ({ id, url: link(badgeUrls[n] as string) })),
        seo: {
          title: seoTitle.trim() || null, description: seoDescription.trim() || null, keywords: list(keywords), ogImage: link(ogImage), ogImageAlt: ogAlt.trim() || null,
          sameAs: list(sameAs).map(link).filter((x): x is string => x !== null), fontUrl: link(fontUrl), indexable: indexable !== 0,
          verify: { google: token(vGoogle), bing: token(vBing), yandex: token(vYandex), enamad: token(vEnamad) },
          analytics: link(statsUrl) && token(statsId) ? { scriptUrl: link(statsUrl) as string, siteId: token(statsId) as string } : null,
        },
      },
      cast: cast.map((c) => ({ id: c.id, name: c.nameFa, role: c.roleFa, bio: c.bioFa, image: c.imageKey })),
      faq: faq.map((f) => ({ question: f.questionFa, answer: f.answerFa })),
    };
  });

  // The try-it puzzle of the landing (an approved, non-daily puzzle); 404 until the catalog has an eligible one.
  app.get('/public/landing-demo', async (_req, reply) => {
    const demo = await landing.publicDemo();
    return demo ?? reply.code(404).send({ error: 'not_found' });
  });

  // Aggregate-only numbers for the stats page; nothing here identifies a player.
  app.get('/public/stats', async () => ({ ...(await landing.stats()), at: Date.now() }));

  // Liveness for the status page: the process answers, the database answers, and whether the admin put the game in maintenance mode.
  const startedAt = Date.now();
  app.get('/public/status', async () => {
    const t0 = Date.now();
    let db: 'ok' | 'down' = 'ok';
    try {
      await landing.stats();
    } catch {
      db = 'down';
    }
    return { api: 'ok', db, dbMs: Date.now() - t0, maintenance: (await settings.num('app.maintenance_on')) === 1, uptimeSec: Math.floor((Date.now() - startedAt) / 1000), at: Date.now() };
  });

  const commentQuery = z.object({ type: z.enum(['post', 'cast']), key: z.string().min(1).max(120) });
  app.get('/public/comments', async (req, reply) => {
    const q = commentQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'invalid_request' });
    return { comments: await landing.publicComments(q.data.type, q.data.key) };
  });
  app.get('/public/comment-counts', async (req, reply) => {
    const q = z.object({ type: z.enum(['post', 'cast']) }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'invalid_request' });
    return { counts: await landing.approvedCommentCounts(q.data.type) };
  });
  // The landing app forwards the visitor's address in `x-visitor`, so the limit is per visitor, not per landing container.
  // Accepted comments are limited tightly; every attempt (even a rejected one) is limited loosely so the filter cannot be probed endlessly.
  const accepted = new RateLimiter(3, 10 * 60_000);
  const attempts = new RateLimiter(20, 10 * 60_000);
  app.post('/public/comments', async (req, reply) => {
    const b = commentQuery.extend({ name: z.string().max(100), body: z.string().max(2000) }).safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
    const who = String(req.headers['x-visitor'] ?? req.ip).slice(0, 80);
    if (accepted.blocked(who) || !attempts.take(who)) return reply.code(429).header('retry-after', String(accepted.retryAfterSec(who))).send({ error: 'rate_limited' });
    const out = await landing.submitComment({ targetType: b.data.type, targetKey: b.data.key, authorName: b.data.name, body: b.data.body });
    if (!out.ok) return reply.code(out.error === 'not_found' ? 404 : 400).send({ error: out.error });
    accepted.take(who);
    return reply.code(202).send({ status: out.status });
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

  g.get('/admin/landing/comments', async (req) => {
    const st = z.enum(['pending', 'approved', 'hidden']).optional().safeParse((req.query as { status?: string }).status);
    return { comments: await landing.adminComments(st.success ? st.data : undefined) };
  });
  g.patch('/admin/landing/comments/:id', async (req, reply) => {
    const p = idParam.safeParse(req.params);
    const b = z.object({ status: z.enum(['pending', 'approved', 'hidden']) }).safeParse(req.body);
    if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
    if ((await landing.setCommentStatus(p.data.id, b.data.status)) === 'not_found') return reply.code(404).send({ error: 'not_found' });
    audit('landing.comment.set', p.data.id, b.data.status);
    return { ok: true };
  });
}
