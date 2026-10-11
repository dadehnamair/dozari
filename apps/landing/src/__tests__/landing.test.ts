import { describe, expect, it } from 'vitest';
import { ContentApi } from '../api.js';
import type { DemoPuzzle, LandingData, Post } from '../api.js';
import { headingId, plainText, renderMarkdown } from '../markdown.js';
import { breadcrumbList, description, graphScript } from '../seo.js';
import { buildLanding } from '../server.js';

const DATA: LandingData = {
  site: { name: 'دوزاری', tagline: 'بازی نوستالژی قیمت‌ها', heroTitle: 'قیمت‌های قدیمی را حدس بزن', heroText: 'دوزاری یک بازی آنلاین فارسی است.', contactEmail: null, instagram: 'https://instagram.com/dozari', channel: null, androidApp: null, iosApp: null, appUrl: 'https://mrbots.ir', domains: { app: 'mrbots.ir', landing: 'mrdozari.ir', short: '2oi.ir' }, seo: { title: null, description: null, keywords: [], ogImage: null, ogImageAlt: null, sameAs: [], fontUrl: null, indexable: true, verify: { google: null, bing: null, yandex: null } } },
  cast: [{ id: 'c1', name: 'دوزاری', role: 'راهنمای بازار', bio: 'نگهبان بازار است.', image: 'dozari' }],
  faq: [{ question: 'دوزاری چیست؟', answer: 'یک بازی فارسی است.' }],
};
const POST: Post = { slug: 'نان-۱۳۵۰', title: 'قیمت نان در ۱۳۵۰', summary: 'نان چند بود؟', coverUrl: null, author: 'تحریریه', publishedAt: Date.UTC(2026, 8, 1), updatedAt: Date.UTC(2026, 8, 5), bodyMd: '## نان\nنان ارزان بود.\n\n## شیر\nشیر هم.\n\n## چای\nچای هم.\n\n- یک\n- دو', metaTitle: null, metaDescription: null };

/** A fake game server: `fail` makes every call error out. */
function fakeApi(state: { fail?: boolean } = {}, posts: Post[] = [POST], redirects: Record<string, string> = {}, data: LandingData = DATA, demo: DemoPuzzle | null = null) {
  const fetcher = async (url: string) => {
    if (state.fail) throw new Error('down');
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const json = (v: unknown, status = 200) => ({ ok: status < 400, status, json: async () => v });
    if (path === '/public/landing') return json(data);
    if (path === '/public/landing-demo') return demo ? json(demo) : json({ error: 'not_found' }, 404);
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

describe('banners and icons', () => {
  it('serves the banners, the social card, the favicon and the manifest, and nothing outside them', async () => {
    const app = buildLanding({ api: fakeApi(), siteUrl: 'https://mrdozari.ir' });
    const b = await app.inject({ method: 'GET', url: '/banners/banner1.webp' });
    expect(b.statusCode).toBe(200);
    expect(b.headers['content-type']).toBe('image/webp');
    expect((await app.inject({ method: 'GET', url: '/banners/og.jpg' })).headers['content-type']).toBe('image/jpeg');
    expect((await app.inject({ method: 'GET', url: '/banners/banner9.webp' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/banners/..%2Fserver.ts' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/favicon.ico' })).headers['content-type']).toBe('image/x-icon');
    expect((await app.inject({ method: 'GET', url: '/icons/apple-touch-icon.png' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/icons/nope.png' })).statusCode).toBe(404);
    const m = JSON.parse((await app.inject({ method: 'GET', url: '/site.webmanifest' })).body);
    expect(m.name).toBe('دوزاری');
    const home = (await app.inject({ method: 'GET', url: '/' })).body;
    expect(home).toContain('rel="icon"');
    expect(home).toContain('rel="manifest"');
    expect(home).toContain('/banners/banner2.webp');
    expect(home.match(/<h1[ >]/g)).toHaveLength(1);
  });
});

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
    const b = breadcrumbList({ name: 'x', tagline: '', url: 'https://s.test', contactEmail: null, sameAs: [], appUrl: null, androidApp: null, iosApp: null }, [{ name: 'a', path: '/' }, { name: 'b' }]) as { itemListElement: { position: number; item?: string }[] };
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

  it('draws the try-it puzzle from the catalog with icons, and keeps the static one when there is none', async () => {
    const demo: DemoPuzzle = { groups: [0, 1, 2, 3].map((level) => ({ level, title: `گروه ${level}`, items: [0, 1, 2, 3].map((n) => ({ name: `کالا ${level}${n}`, svg: '<svg viewBox="0 0 8 8"></svg>', image: n === 0 ? 'https://cdn.example/p.jpg' : null })) })) };
    const live = (await buildLanding({ api: fakeApi({}, [POST], {}, DATA, demo), siteUrl: 'https://mrdozari.ir' }).inject({ method: 'GET', url: '/' })).body;
    expect(live).toContain('class="demo icons"');
    expect(live.match(/<button class="t"[^>]*><svg/g)).toHaveLength(12);
    expect(live.match(/<button class="t"[^>]*><img src="https:\/\/cdn.example\/p.jpg"/g)).toHaveLength(4);
    expect(live).toContain('کالا 00');
    const fallback = (await boot().inject({ method: 'GET', url: '/' })).body;
    expect(fallback).not.toContain('demo icons');
    expect(fallback.match(/<button class="t"/g)).toHaveLength(16);
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

describe('admin-set SEO (group «سئو و سایت معرفی»)', () => {
  const withSeo = (seo: Partial<LandingData['site']['seo']>): LandingData => ({ ...DATA, site: { ...DATA.site, seo: { ...DATA.site.seo, ...seo } } });
  const boot = (data: LandingData) => buildLanding({ api: fakeApi({}, [POST], {}, data), siteUrl: 'https://mrdozari.ir' });
  type Node = { '@type': string; sameAs?: string[]; keywords?: string };

  it('uses the home title and description, the og image with its alt text, verification tags and extra sameAs', async () => {
    const html = (await boot(withSeo({ title: 'دوزاری | بازی قیمت‌های قدیمی', description: 'توضیح دلخواه من', ogImage: 'https://cdn.example/og.png', ogImageAlt: 'کارت دوزاری', sameAs: ['https://aparat.com/dozari'], keywords: ['دوزاری', 'قیمت قدیم'], verify: { google: 'abc123', bing: 'bing-1', yandex: 'yan_2' } })).inject({ method: 'GET', url: '/' })).body;
    expect(html).toContain('<title>دوزاری | بازی قیمت‌های قدیمی</title>');
    expect(html).toContain('<meta name="description" content="توضیح دلخواه من">');
    expect(html).toContain('<meta property="og:image" content="https://cdn.example/og.png">');
    expect(html).toContain('<meta property="og:image:alt" content="کارت دوزاری">');
    expect(html).toContain('<meta name="google-site-verification" content="abc123">');
    expect(html).toContain('<meta name="msvalidate.01" content="bing-1">');
    expect(html).toContain('<meta name="yandex-verification" content="yan_2">');
    const graph = jsonLd(html)[0]['@graph'] as Node[];
    expect(graph.find((n) => n['@type'] === 'Organization')?.sameAs).toContain('https://aparat.com/dozari');
    expect(graph.find((n) => n['@type'] === 'WebSite')?.keywords).toBe('دوزاری, قیمت قدیم');
  });

  it('adds the self-hosted analytics script only when the admin set one', async () => {
    expect((await boot(DATA).inject({ method: 'GET', url: '/' })).body).not.toContain('data-website-id');
    const html = (await boot(withSeo({ analytics: { scriptUrl: 'https://stats.example.ir/script.js', siteId: 'abcd-1234' } })).inject({ method: 'GET', url: '/' })).body;
    expect(html).toContain('<script defer src="https://stats.example.ir/script.js" data-website-id="abcd-1234"></script>');
  });

  it('adds the web font only when a font address is set', async () => {
    const plain = (await boot(DATA).inject({ method: 'GET', url: '/' })).body;
    expect(plain).not.toContain('DozariWeb');
    const html = (await boot(withSeo({ fontUrl: 'https://mrdozari.ir/fonts/v.woff2' })).inject({ method: 'GET', url: '/' })).body;
    expect(html).toContain('rel="preload" href="https://mrdozari.ir/fonts/v.woff2"');
    expect(html).toContain('DozariWeb');
  });

  it('closes the whole site while indexing is off, and opens it again', async () => {
    const closed = boot(withSeo({ indexable: false }));
    expect((await closed.inject({ method: 'GET', url: '/robots.txt' })).body).toBe('User-agent: *\nDisallow: /\n');
    expect((await closed.inject({ method: 'GET', url: '/' })).body).toContain('content="noindex, follow"');
    expect((await closed.inject({ method: 'GET', url: '/sitemap.xml' })).body).not.toContain('/blog/');
    expect((await boot(DATA).inject({ method: 'GET', url: '/' })).body).toContain('index, follow');
  });

  it('serves a plain brand card at /og.svg and uses it when no image is set', async () => {
    const app = boot(DATA);
    const svg = await app.inject({ method: 'GET', url: '/og.svg' });
    expect(svg.statusCode).toBe(200);
    expect(svg.headers['content-type']).toContain('image/svg+xml');
    expect(svg.body).toContain('دوزاری');
    expect((await app.inject({ method: 'GET', url: '/about' })).body).toContain('content="https://mrdozari.ir/banners/og.jpg"');
  });
});

describe('privacy policy page', () => {
  it('is a real indexable page with one h1, listed in the sitemap and linked from every footer', async () => {
    const app = buildLanding({ api: fakeApi(), siteUrl: 'https://mrdozari.ir' });
    const res = await app.inject({ method: 'GET', url: '/privacy' });
    expect(res.statusCode).toBe(200);
    expect(res.body.match(/<h1>/g)).toHaveLength(1);
    expect(res.body).toContain('<link rel="canonical" href="https://mrdozari.ir/privacy">');
    expect(res.body).toContain('index, follow');
    expect((await app.inject({ method: 'GET', url: '/sitemap.xml' })).body).toContain('<loc>https://mrdozari.ir/privacy</loc>');
    expect((await app.inject({ method: 'GET', url: '/' })).body).toContain('<a href="/privacy">حریم خصوصی</a>');
  });

  it('shows the contact e-mail only when the owner set one', async () => {
    const withMail: LandingData = { ...DATA, site: { ...DATA.site, contactEmail: 'hi@mrdozari.ir' } };
    const html = (await buildLanding({ api: fakeApi({}, [POST], {}, withMail), siteUrl: 'https://mrdozari.ir' }).inject({ method: 'GET', url: '/privacy' })).body;
    expect(html).toContain('mailto:hi@mrdozari.ir');
    expect((await buildLanding({ api: fakeApi(), siteUrl: 'https://mrdozari.ir' }).inject({ method: 'GET', url: '/privacy' })).body).not.toContain('mailto:');
  });
});


describe('design pages: about, download, contact', () => {
  it('are indexable pages with one h1, the nav, canonical and a sitemap entry', async () => {
    const app = buildLanding({ api: fakeApi(), siteUrl: 'https://mrdozari.ir' });
    const map = (await app.inject({ method: 'GET', url: '/sitemap.xml' })).body;
    for (const path of ['/about', '/ages', '/download', '/contact']) {
      const res = await app.inject({ method: 'GET', url: path });
      expect(res.statusCode).toBe(200);
      expect(res.body.match(/<h1[ >]/g)).toHaveLength(1);
      expect(res.body).toContain(`<link rel="canonical" href="https://mrdozari.ir${path}">`);
      expect(res.body).toContain(`<a href="${path}" aria-current="page">`);
      expect(map).toContain(`<loc>https://mrdozari.ir${path}</loc>`);
    }
  });

  it('ages puts the adult game first, links every banner it uses and carries FAQPage markup', async () => {
    const app = buildLanding({ api: fakeApi(), siteUrl: 'https://mrdozari.ir' });
    const html = (await app.inject({ method: 'GET', url: '/ages' })).body;
    expect(html.indexOf('id="adult"')).toBeGreaterThan(-1);
    expect(html.indexOf('id="adult"')).toBeLessThan(html.indexOf('id="kids"'));
    for (const b of ['age-adult', 'age-kid', 'age-teen']) expect(html).toContain(`/banners/${b}.webp`);
    for (const b of ['age-adult', 'age-kid', 'age-teen']) expect((await app.inject({ method: 'GET', url: `/banners/${b}.webp` })).statusCode).toBe(200);
    expect(html).toContain('FAQPage');
    expect((await app.inject({ method: 'GET', url: '/llms.txt' })).body).toContain('/ages');
  });

  it('the home page shows the adult band before the kid and teen strip', async () => {
    const html = (await buildLanding({ api: fakeApi(), siteUrl: 'https://mrdozari.ir' }).inject({ method: 'GET', url: '/' })).body;
    expect(html).toContain('class="band ad" id="adult"');
    expect(html.indexOf('id="adult"')).toBeLessThan(html.indexOf('/banners/age-kid.webp'));
    expect(html).toContain('href="/ages#adult"');
  });

  it('contact lists the FAQ with FAQPage markup', async () => {
    const html = (await buildLanding({ api: fakeApi(), siteUrl: 'https://mrdozari.ir' }).inject({ method: 'GET', url: '/contact' })).body;
    expect(html).toContain('FAQPage');
    expect(html).toContain('<details class="faq"');
  });
});

describe('self-hosted fonts', () => {
  const boot = () => buildLanding({ api: fakeApi(), siteUrl: 'https://mrdozari.ir' });
  it('serves the bundled woff2 files and refuses any other name', async () => {
    const app = boot();
    const ok = await app.inject({ method: 'GET', url: '/fonts/Lalezar-Regular.woff2' });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['content-type']).toBe('font/woff2');
    expect((await app.inject({ method: 'GET', url: '/fonts/..%2Fserver.ts' })).statusCode).toBe(404);
    const home = await app.inject({ method: 'GET', url: '/' });
    expect(home.body).toContain('/fonts/Lalezar-Regular.woff2');
    expect(home.body).not.toContain('fonts.googleapis.com');
  });

  it('serves the designed characters and item icons, and nothing else', async () => {
    const app = boot();
    const ch = await app.inject({ method: 'GET', url: '/characters/dozari-cheer-anim.svg' });
    expect(ch.statusCode).toBe(200);
    expect(ch.headers['content-type']).toContain('image/svg+xml');
    expect(ch.body).toContain('@keyframes dzc-bob');
    expect((await app.inject({ method: 'GET', url: '/items/coin.svg' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/characters/nobody-idle.svg' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/characters/..%2F..%2Fserver.svg' })).statusCode).toBe(404);
  });

  it('draws the cast on the home page and a QR code with a mail form on the pages that need them', async () => {
    const app = boot();
    const home = (await app.inject({ method: 'GET', url: '/' })).body;
    expect(home).toContain('/characters/dozari-cheer-anim.svg');
    expect(home).toContain('-idle.svg');
    const dl = (await app.inject({ method: 'GET', url: '/download' })).body;
    expect(dl).toContain('<svg version="1.1"');
    const withMail: LandingData = { ...DATA, site: { ...DATA.site, contactEmail: 'hi@mrdozari.ir' } };
    const mailApp = buildLanding({ api: fakeApi({}, [POST], {}, withMail), siteUrl: 'https://mrdozari.ir' });
    expect((await mailApp.inject({ method: 'GET', url: '/contact' })).body).toContain('action="mailto:hi@mrdozari.ir"');
    expect((await app.inject({ method: 'GET', url: '/contact' })).body).not.toContain('action="mailto:');
  });
});

describe('terms page', () => {
  it('is a real indexable page with one h1, listed in the sitemap and linked from the footer', async () => {
    const app = buildLanding({ api: fakeApi(), siteUrl: 'https://mrdozari.ir' });
    const res = await app.inject({ method: 'GET', url: '/terms' });
    expect(res.statusCode).toBe(200);
    expect(res.body.match(/<h1>/g)).toHaveLength(1);
    expect(res.body).toContain('<link rel="canonical" href="https://mrdozari.ir/terms">');
    expect((await app.inject({ method: 'GET', url: '/sitemap.xml' })).body).toContain('<loc>https://mrdozari.ir/terms</loc>');
    expect((await app.inject({ method: 'GET', url: '/' })).body).toContain('<a href="/terms">قوانین و شرایط</a>');
  });
});

describe('styled sitemap.xml', () => {
  it('links its stylesheet and serves it as XSL', async () => {
    const app = buildLanding({ api: fakeApi(), siteUrl: 'https://mrdozari.ir' });
    expect((await app.inject({ method: 'GET', url: '/sitemap.xml' })).body).toContain('<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>');
    const xsl = await app.inject({ method: 'GET', url: '/sitemap.xsl' });
    expect(xsl.statusCode).toBe(200);
    expect(xsl.headers['content-type']).toContain('text/xsl');
    expect(xsl.body).toContain('xsl:stylesheet');
  });
});
