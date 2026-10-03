import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ContentApi, LandingData, Post, PostSummary } from './api.js';
import { llmsFull, llmsTxt, robots, sitemap } from './discovery.js';
import { blogIndexPage, castPage, homePage, notFoundPage, postPage, unavailablePage } from './pages.js';
import type { Site } from './seo.js';

export interface LandingOptions {
  api: ContentApi;
  /** The origin of this site (`https://mrdozari.ir`); when empty it is read from the game's `domain.landing` setting. */
  siteUrl?: string;
}

const HTML = 'text/html; charset=utf-8';

function siteOf(data: LandingData, siteUrl: string | undefined): Site {
  const s = data.site;
  const url = (siteUrl && siteUrl.trim() !== '' ? siteUrl.trim() : s.domains.landing ? `https://${s.domains.landing}` : 'http://localhost:3100').replace(/\/+$/, '');
  return { name: s.name, tagline: s.tagline, url, contactEmail: s.contactEmail, sameAs: [s.instagram, s.channel].filter((x): x is string => !!x), appUrl: s.appUrl ?? (s.domains.app ? `https://${s.domains.app}` : null), androidApp: s.androidApp };
}

/** Every published post (the API pages them at 50). */
async function allPosts(api: ContentApi): Promise<PostSummary[]> {
  const out: PostSummary[] = [];
  for (let page = 1; page <= 100; page++) {
    const l = await api.posts(page, 50);
    out.push(...l.posts);
    if (out.length >= l.total || l.posts.length === 0) break;
  }
  return out;
}

/**
 * The landing site (item 8, D173): server-rendered HTML so crawlers and answer engines read everything without running scripts.
 * Unknown paths are a real 404, a renamed post is a 301, and when the game server is unreachable the page says so with a 503.
 */
export function buildLanding(opts: LandingOptions): FastifyInstance {
  const app = Fastify({ logger: false, trustProxy: true });
  const { api } = opts;

  const send = (reply: FastifyReply, status: number, html: string, cache = 'public, max-age=300, stale-while-revalidate=3600') => reply.code(status).header('content-type', HTML).header('cache-control', cache).send(html);
  const text = (reply: FastifyReply, type: string, body: string) => reply.header('content-type', `${type}; charset=utf-8`).header('cache-control', 'public, max-age=3600').send(body);

  // A failed call to the game server is a 503 page, never a stack trace.
  app.setErrorHandler(async (_err, _req, reply) => {
    let html = '<!doctype html><meta charset="utf-8"><title>به‌زودی برمی‌گردیم</title><p>سایت برای چند دقیقه در دسترس نیست.</p>';
    try {
      html = unavailablePage(siteOf(await api.landing(), opts.siteUrl));
    } catch {
      /* the plain fallback above */
    }
    return send(reply, 503, html, 'no-store');
  });

  app.get('/health', async () => ({ ok: true }));

  app.get('/', async (_req, reply) => {
    const [data, list] = await Promise.all([api.landing(), api.posts(1, 3)]);
    return send(reply, 200, homePage(siteOf(data, opts.siteUrl), data, list.posts));
  });

  app.get('/blog', async (req, reply) => {
    const raw = Number((req.query as { page?: string }).page ?? 1);
    const page = Number.isInteger(raw) && raw >= 1 ? raw : 1;
    const [data, list] = await Promise.all([api.landing(), api.posts(page, 12)]);
    const site = siteOf(data, opts.siteUrl);
    if (page > 1 && list.posts.length === 0) return send(reply, 404, notFoundPage(site), 'public, max-age=60');
    return send(reply, 200, blogIndexPage(site, list));
  });

  app.get('/blog/:slug', async (req, reply) => {
    const slug = (req.params as { slug: string }).slug;
    const [data, found] = await Promise.all([api.landing(), api.post(slug)]);
    const site = siteOf(data, opts.siteUrl);
    if (!found) return send(reply, 404, notFoundPage(site), 'public, max-age=60');
    if ('redirectTo' in found) return reply.code(301).header('cache-control', 'public, max-age=86400').redirect(`/blog/${encodeURIComponent(found.redirectTo)}`, 301);
    const post: Post = found.post;
    const more = (await api.posts(1, 4)).posts.filter((p) => p.slug !== post.slug).slice(0, 3);
    return send(reply, 200, postPage(site, post, more));
  });

  app.get('/cast', async (_req, reply) => {
    const data = await api.landing();
    return send(reply, 200, castPage(siteOf(data, opts.siteUrl), data.cast));
  });

  app.get('/sitemap.xml', async (_req, reply) => {
    const [data, posts] = await Promise.all([api.landing(), allPosts(api)]);
    return text(reply, 'application/xml', sitemap(siteOf(data, opts.siteUrl), posts));
  });
  app.get('/robots.txt', async (_req, reply) => text(reply, 'text/plain', robots(siteOf(await api.landing(), opts.siteUrl))));
  app.get('/llms.txt', async (_req, reply) => {
    const [data, posts] = await Promise.all([api.landing(), allPosts(api)]);
    return text(reply, 'text/plain', llmsTxt(siteOf(data, opts.siteUrl), data, posts));
  });
  app.get('/llms-full.txt', async (_req, reply) => {
    const data = await api.landing();
    const summaries = await allPosts(api);
    const full: { title: string; slug: string; bodyMd: string }[] = [];
    for (const s of summaries) {
      const f = await api.post(s.slug);
      if (f && 'post' in f) full.push({ title: f.post.title, slug: f.post.slug, bodyMd: f.post.bodyMd });
    }
    return text(reply, 'text/plain', llmsFull(siteOf(data, opts.siteUrl), data, full));
  });

  // Anything else is a real 404 (never a 200 «not found» page: that is a soft 404 for Search Console).
  app.setNotFoundHandler(async (_req, reply) => {
    const data = await api.landing();
    return send(reply, 404, notFoundPage(siteOf(data, opts.siteUrl)), 'public, max-age=60');
  });

  return app;
}
