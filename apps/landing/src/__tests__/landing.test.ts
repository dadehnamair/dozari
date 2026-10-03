import { describe, expect, it } from 'vitest';
import { ContentApi } from '../api.js';
import type { LandingData, Post } from '../api.js';
import { headingId, plainText, renderMarkdown } from '../markdown.js';
import { breadcrumbList, description, graphScript } from '../seo.js';
import { buildLanding } from '../server.js';

const DATA: LandingData = {
  site: { name: 'دوزاری', tagline: 'بازی نوستالژی قیمت‌ها', heroTitle: 'قیمت‌های قدیمی را حدس بزن', heroText: 'دوزاری یک بازی آنلاین فارسی است.', contactEmail: null, instagram: 'https://instagram.com/dozari', channel: null, androidApp: null, appUrl: 'https://mrbots.ir', domains: { app: 'mrbots.ir', landing: 'mrdozari.ir', short: '2oi.ir' } },
  cast: [{ id: 'c1', name: 'دوزاری', role: 'راهنمای بازار', bio: 'نگهبان بازار است.', image: 'dozari' }],
  faq: [{ question: 'دوزاری چیست؟', answer: 'یک بازی فارسی است.' }],
};
const POST: Post = { slug: 'نان-۱۳۵۰', title: 'قیمت نان در ۱۳۵۰', summary: 'نان چند بود؟', coverUrl: null, author: 'تحریریه', publishedAt: Date.UTC(2026, 8, 1), updatedAt: Date.UTC(2026, 8, 5), bodyMd: '## نان\nنان ارزان بود.\n\n## شیر\nشیر هم.\n\n## چای\nچای هم.\n\n- یک\n- دو', metaTitle: null, metaDescription: null };

/** A fake game server: `fail` makes every call error out. */
function fakeApi(state: { fail?: boolean } = {}, posts: Post[] = [POST], redirects: Record<string, string> = {}) {
  const fetcher = async (url: string) => {
    if (state.fail) throw new Error('down');
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const json = (v: unknown, status = 200) => ({ ok: status < 400, status, json: async () => v });
    if (path === '/public/landing') return json(DATA);
    if (path.startsWith('/public/posts?')) {
      const q = new URLSearchParams(path.split('?')[1]);
      const page = Number(q.get('page') ?? 1);
      const size = Number(q.get('pageSize') ?? 12);
      const rows = posts.slice((page - 1) * size, page * size).map(({ bodyMd: _b, metaTitle: _m, metaDescription: _d, ...s }) => s);
      return json({ posts: rows, total: posts.length, page, pageSize: size });
    }
    const slug = decodeURIComponent(path.replace('/public/posts/', ''));
    const p = posts.find((x) => x.slug === slug);
    if (p) return json({ post: p });
    if (redirects[slug]) return json({ redirectTo: redirects[slug] });
    return json({ error: 'not_found' }, 404);
  };
  return new ContentApi('http://api', fetcher, 0);
}

const jsonLd = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1] as string));

describe('markdown', () => {
  it('escapes raw HTML and refuses unsafe links', () => {
    const { html } = renderMarkdown('<script>alert(1)</script>\n\n[bad](javascript:alert(1)) [ok](https://x.test/a?b=1&c=2) [rel](/blog)');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('<a href="https://x.test/a?b=1&amp;c=2" rel="noopener">ok</a>');
    expect(html).toContain('<a href="/blog">rel</a>');
  });
  it('gives headings unique anchor ids and builds lists and quotes', () => {
    const { html, headings } = renderMarkdown('## نان\n\n## نان\n\n### ریز\n\n1. الف\n2. ب\n\n> نقل\n\n**مهم** و *کج*');
    expect(headings.map((h) => h.id)).toEqual(['نان', 'نان-2', 'ریز']);
    expect(html).toContain('<h2 id="نان">نان</h2>');
    expect(html).toContain('<ol><li>الف</li><li>ب</li></ol>');
    expect(html).toContain('<blockquote><p>نقل</p></blockquote>');
    expect(html).toContain('<strong>مهم</strong>');
    expect(headingId('!!!')).toBe('section');
    expect(plainText('## عنوان\n[لینک](http://x) **تو**')).toBe('عنوان\nلینک تو');
  });
});

describe('seo helpers', () => {
  it('cuts a description on a word boundary and keeps short ones whole', () => {
    expect(description('کوتاه   است')).toBe('کوتاه است');
    const long = description('کلمه '.repeat(60));
    expect(long.length).toBeLessThanOrEqual(160);
    expect(long.endsWith('…')).toBe(true);
  });
  it('escapes < inside JSON-LD and numbers the breadcrumb', () => {
    expect(graphScript([{ '@type': 'Thing', name: '</script><b>' }])).not.toContain('</script><b>');
    const b = breadcrumbList({ name: 'x', tagline: '', url: 'https://s.test', contactEmail: null, sameAs: [], appUrl: null, androidApp: null }, [{ name: 'a', path: '/' }, { name: 'b' }]) as { itemListElement: { position: number; item?: string }[] };
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(b.itemListElement[1]).not.toHaveProperty('item');
  });
});

describe('landing site', () => {
  const boot = (state?: { fail?: boolean }, posts?: Post[], redirects?: Record<string, string>) => buildLanding({ api: fakeApi(state, posts, redirects), siteUrl: 'https://mrdozari.ir' });

  it('renders the home page with one h1, a canonical, FAQ and HowTo structured data and real links', async () => {
    const res = await boot().inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    const html = res.body;
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html.match(/<link rel="canonical"/g)).toHaveLength(1);
    expect(html).toContain('<link rel="canonical" href="https://mrdozari.ir/">');
    expect(html).toContain('<html lang="fa" dir="rtl">');
    const graph = jsonLd(html)[0]['@graph'] as { '@type': string; '@id'?: string }[];
    expect(graph.filter((n) => n['@type'] === 'Organization')).toHaveLength(1);
    expect(graph.map((n) => n['@type'])).toEqual(expect.arrayContaining(['WebSite', 'WebPage', 'HowTo', 'FAQPage']));
    expect(html).toContain('href="/blog/%D9%86%D8%A7%D9%86-%DB%B1%DB%B3%DB%B5%DB%B0"');
    expect(html).toContain('href="/cast"');
  });

  it('renders a post with BlogPosting data, breadcrumbs, anchors and a table of contents', async () => {
    const res = await boot().inject({ method: 'GET', url: `/blog/${encodeURIComponent(POST.slug)}` });
    expect(res.statusCode).toBe(200);
    const html = res.body;
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain('<h2 id="نان">نان</h2>');
    expect(html).toContain('href="#نان"');
    const graph = jsonLd(html)[0]['@graph'] as { '@type': string; datePublished?: string; publisher?: { '@id': string } }[];
    const article = graph.find((n) => n['@type'] === 'BlogPosting')!;
    expect(article.datePublished).toBe(new Date(POST.publishedAt).toISOString());
    expect(article.publisher).toEqual({ '@id': 'https://mrdozari.ir/#organization' });
    expect(graph.find((n) => n['@type'] === 'BreadcrumbList')).toBeTruthy();
    expect(graph.filter((n) => n['@type'] === 'Organization')).toHaveLength(1);
    expect(html).toContain('property="og:type" content="article"');
  });

  it('301s a renamed post, and a missing page is a real 404 with noindex', async () => {
    const app = boot(undefined, [POST], { 'old-name': POST.slug });
    const moved = await app.inject({ method: 'GET', url: '/blog/old-name' });
    expect(moved.statusCode).toBe(301);
    expect(decodeURIComponent(moved.headers.location as string)).toBe(`/blog/${POST.slug}`);
    const missing = await app.inject({ method: 'GET', url: '/blog/never' });
    expect(missing.statusCode).toBe(404);
    expect(missing.body).toContain('noindex');
    expect((await app.inject({ method: 'GET', url: '/nothing-here' })).statusCode).toBe(404);
  });

  it('paginates the blog with a canonical per page', async () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ ...POST, slug: `p${i + 1}x`, title: `مقاله ${i + 1}` }));
    const app = boot(undefined, many);
    const p1 = (await app.inject({ method: 'GET', url: '/blog' })).body;
    expect(p1).toContain('<link rel="canonical" href="https://mrdozari.ir/blog">');
    expect(p1).toContain('href="/blog?page=2"');
    const p2 = (await app.inject({ method: 'GET', url: '/blog?page=2' })).body;
    expect(p2).toContain('<link rel="canonical" href="https://mrdozari.ir/blog?page=2">');
    expect((await app.inject({ method: 'GET', url: '/blog?page=9' })).statusCode).toBe(404);
  });

  it('publishes sitemap, robots and llms files from the same content', async () => {
    const app = boot();
    const map = (await app.inject({ method: 'GET', url: '/sitemap.xml' })).body;
    expect(map).toContain('<loc>https://mrdozari.ir/</loc>');
    expect(map).toContain(`<loc>https://mrdozari.ir/blog/${encodeURIComponent(POST.slug)}</loc>`);
    expect(map).toContain(`<lastmod>${new Date(POST.updatedAt).toISOString()}</lastmod>`);
    expect(map).toContain('hreflang="x-default"');
    expect(map).not.toContain('/404');
    const robots = (await app.inject({ method: 'GET', url: '/robots.txt' })).body;
    expect(robots).toContain('User-agent: GPTBot\nAllow: /');
    expect(robots).toContain('Sitemap: https://mrdozari.ir/sitemap.xml');
    const llms = (await app.inject({ method: 'GET', url: '/llms.txt' })).body;
    expect(llms).toContain('# دوزاری');
    expect(llms).toContain(`(https://mrdozari.ir/blog/${encodeURIComponent(POST.slug)})`);
    const full = (await app.inject({ method: 'GET', url: '/llms-full.txt' })).body;
    expect(full).toContain('نان ارزان بود.');
    expect(full).toContain('### دوزاری چیست؟');
  });

  it('answers 503 with a calm page when the game server is unreachable', async () => {
    const res = await boot({ fail: true }).inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(503);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toContain('به‌زودی برمی‌گردیم');
  });

  it('serves the last good answer when the game server goes down later', async () => {
    const state: { fail?: boolean } = {};
    const api = new ContentApi('http://api', fakeApiFetcher(state), 0);
    const app = buildLanding({ api, siteUrl: 'https://mrdozari.ir' });
    expect((await app.inject({ method: 'GET', url: '/cast' })).statusCode).toBe(200);
    state.fail = true;
    expect((await app.inject({ method: 'GET', url: '/cast' })).statusCode).toBe(200);
  });
});

function fakeApiFetcher(state: { fail?: boolean }) {
  return async () => {
    if (state.fail) throw new Error('down');
    return { ok: true, status: 200, json: async () => DATA };
  };
}
