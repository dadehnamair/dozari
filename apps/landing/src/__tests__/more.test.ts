import { describe, expect, it } from 'vitest';
import { ContentApi } from '../api.js';
import type { LandingData, Post } from '../api.js';
import { buildStatus } from '../more.js';
import { buildLanding } from '../server.js';

const DATA: LandingData = {
  site: { name: 'دوزاری', tagline: 'بازی نوستالژی قیمت‌ها', heroTitle: 'ه', heroText: 'دوزاری یک بازی آنلاین فارسی است.', contactEmail: 'hi@mrdozari.ir', instagram: null, channel: null, androidApp: null, iosApp: null, appUrl: null, domains: { app: 'mrbots.ir', landing: 'mrdozari.ir', short: '2oi.ir' }, seo: { title: null, description: null, keywords: [], ogImage: null, ogImageAlt: null, sameAs: [], fontUrl: null, indexable: true, verify: { google: null, bing: null, yandex: null } } },
  cast: [{ id: 'c1', name: 'خاله', role: 'بقال محل', bio: 'همه‌چیز را می‌داند.', image: 'khale' }],
  faq: [],
};
const POST: Post = { slug: 'nan', title: 'قیمت نان', summary: 'نان چند بود؟', coverUrl: null, author: '', publishedAt: Date.UTC(2026, 8, 1), updatedAt: Date.UTC(2026, 8, 5), bodyMd: '## نان\nارزان بود.', metaTitle: null, metaDescription: null };

interface State {
  down?: boolean;
  comments: { id: string; author: string; body: string; createdAt: number }[];
  submitted: { body: Record<string, unknown>; visitor: string | undefined }[];
  submitStatus?: number;
}

function fake(state: State) {
  const fetcher = async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const json = (v: unknown, status = 200) => ({ ok: status < 400, status, json: async () => v });
    if (path === '/public/status') {
      if (state.down) throw new Error('down');
      return json({ api: 'ok', db: 'ok', dbMs: 3, maintenance: false, uptimeSec: 7300, at: 1 });
    }
    if (state.down && path !== '/public/landing') throw new Error('down');
    if (path === '/public/landing') return json(DATA);
    if (path === '/public/stats') return json({ players: 1200, products: 340, prices: 5100, puzzles: 88, provinces: 31, years: { from: 1350, to: 1403 }, posts: 1, at: Date.UTC(2026, 8, 6) });
    if (path.startsWith('/public/comment-counts')) return json({ counts: { c1: 2, nan: 3 } });
    if (path.startsWith('/public/comments') && init?.method === 'POST') {
      state.submitted.push({ body: JSON.parse(init.body ?? '{}'), visitor: init.headers?.['x-visitor'] });
      return json(state.submitStatus === 400 ? { error: 'links_not_allowed' } : { status: 'pending' }, state.submitStatus ?? 202);
    }
    if (path.startsWith('/public/comments')) return json({ comments: state.comments });
    if (path.startsWith('/public/posts?')) return json({ posts: [{ ...POST }], total: 1, page: 1, pageSize: 50 });
    if (path === '/public/posts/nan') return json({ post: POST });
    return json({ error: 'not_found' }, 404);
  };
  return buildLanding({ api: new ContentApi('http://api', fetcher as never, 0), siteUrl: 'https://mrdozari.ir' });
}
const fresh = (): State => ({ comments: [], submitted: [] });

describe('new pages', () => {
  it('serves every info page with one h1, a canonical and a breadcrumb', async () => {
    const app = fake(fresh());
    for (const path of ['/sitemap', '/status', '/stats', '/how-to-play', '/modes', '/glossary', '/press', '/cast/c1']) {
      const res = await app.inject({ method: 'GET', url: path });
      expect(res.statusCode, path).toBe(200);
      expect(res.body.match(/<h1[ >]/g)?.length, path).toBe(1);
      expect(res.body, path).toContain(`<link rel="canonical" href="https://mrdozari.ir${path}">`);
      expect(res.body, path).toContain('BreadcrumbList');
    }
  });

  it('the HTML sitemap lists static pages, every cast member and every post', async () => {
    const html = (await fake(fresh()).inject({ method: 'GET', url: '/sitemap' })).body;
    for (const href of ['/stats', '/status', '/how-to-play', '/cast/c1', '/blog/nan', '/sitemap.xml', '/feed.xml']) expect(html).toContain(`href="${href}"`);
  });

  it('sitemap.xml carries the new pages and cast pages; unknown cast id is a real 404', async () => {
    const app = fake(fresh());
    const xml = (await app.inject({ method: 'GET', url: '/sitemap.xml' })).body;
    for (const p of ['/stats', '/status', '/sitemap', '/glossary', '/cast/c1', '/blog/nan']) expect(xml).toContain(`<loc>https://mrdozari.ir${p}</loc>`);
    expect((await app.inject({ method: 'GET', url: '/cast/nope' })).statusCode).toBe(404);
  });

  it('stats shows real numbers in Persian digits and sums comments of posts and cast (the fake returns 5 for each)', async () => {
    const html = (await fake(fresh()).inject({ method: 'GET', url: '/stats' })).body;
    expect(html).toContain('۵٬۱۰۰');
    expect(html).toContain('۱۳۵۰ تا ۱۴۰۳');
    expect(html).toContain('<b>۱۰</b><span>نظر</span>');
  });

  it('glossary, how-to and modes carry structured data', async () => {
    const app = fake(fresh());
    expect((await app.inject({ method: 'GET', url: '/glossary' })).body).toContain('DefinedTermSet');
    expect((await app.inject({ method: 'GET', url: '/how-to-play' })).body).toContain('HowToStep');
    expect((await app.inject({ method: 'GET', url: '/modes' })).body).toContain('ItemList');
  });

  it('serves the RSS feed and security.txt (only with a real contact e-mail)', async () => {
    const app = fake(fresh());
    const rss = await app.inject({ method: 'GET', url: '/feed.xml' });
    expect(rss.headers['content-type']).toContain('application/rss+xml');
    expect(rss.body).toContain('<link>https://mrdozari.ir/blog/nan</link>');
    const sec = await app.inject({ method: 'GET', url: '/.well-known/security.txt' });
    expect(sec.body).toContain('Contact: mailto:hi@mrdozari.ir');
  });
});

describe('status', () => {
  it('reports ok, warns during maintenance and goes down when the game server is silent', () => {
    const up = { reachable: true, ms: 12, status: { api: 'ok', db: 'ok', dbMs: 3, maintenance: false, uptimeSec: 5, at: 1 } as const };
    expect(buildStatus(up, 0).overall).toBe('ok');
    expect(buildStatus({ ...up, status: { ...up.status, maintenance: true } }, 0).overall).toBe('warn');
    expect(buildStatus({ ...up, status: { ...up.status, db: 'down' } }, 0).overall).toBe('down');
    const gone = buildStatus({ reachable: false, ms: 5000, status: null }, 0);
    expect(gone.overall).toBe('down');
    expect(gone.latencyMs).toBeNull();
    expect(gone.services[0]?.level).toBe('ok');
  });

  it('/status is never cached and /status.json answers 503 when the game is down', async () => {
    const state = fresh();
    const app = fake(state);
    const ok = await app.inject({ method: 'GET', url: '/status' });
    expect(ok.headers['cache-control']).toBe('no-store');
    expect((await app.inject({ method: 'GET', url: '/status.json' })).json().overall).toBe('ok');
    state.down = true;
    const bad = await app.inject({ method: 'GET', url: '/status.json' });
    expect(bad.statusCode).toBe(503);
    expect((await app.inject({ method: 'GET', url: '/status' })).statusCode).toBe(200);
  });
});

describe('comments', () => {
  it('shows approved comments escaped, with JSON-LD, on a post and on a cast page', async () => {
    const state = fresh();
    state.comments = [{ id: 'k1', author: '<b>علی</b>', body: 'نان سنگک <script>x</script> بهترین بود', createdAt: Date.UTC(2026, 8, 2) }];
    const app = fake(state);
    for (const url of ['/blog/nan', '/cast/c1']) {
      const html = (await app.inject({ method: 'GET', url })).body;
      expect(html).toContain('&lt;b&gt;علی&lt;/b&gt;');
      expect(html).not.toContain('<script>x</script>');
      expect(html).toContain('"@type":"Comment"');
      expect(html).toContain('action="/comments"');
    }
  });

  it('forwards a form post with the visitor address and redirects back with a notice (303)', async () => {
    const state = fresh();
    const app = fake(state);
    const res = await app.inject({ method: 'POST', url: '/comments', payload: 'type=post&key=nan&name=%D8%B9%D9%84%DB%8C&body=%D8%B9%D8%A7%D9%84%DB%8C%20%D8%A8%D9%88%D8%AF&website=', headers: { 'content-type': 'application/x-www-form-urlencoded' }, remoteAddress: '9.9.9.9' });
    expect(res.statusCode).toBe(303);
    expect(res.headers.location).toBe('/blog/nan?c=ok#comments');
    expect(state.submitted).toHaveLength(1);
    expect(state.submitted[0]?.body).toMatchObject({ type: 'post', key: 'nan', name: 'علی' });
    expect(state.submitted[0]?.visitor).toBe('9.9.9.9');
    const page = await app.inject({ method: 'GET', url: '/blog/nan?c=ok' });
    expect(page.body).toContain('نظرت ثبت شد');
    expect(page.headers['cache-control']).toBe('no-store');
  });

  it('a filled honeypot is dropped silently and a rejected comment shows the reason', async () => {
    const state = fresh();
    const app = fake(state);
    const form = { 'content-type': 'application/x-www-form-urlencoded' };
    const bot = await app.inject({ method: 'POST', url: '/comments', payload: 'type=cast&key=c1&name=ab&body=hello&website=http%3A%2F%2Fspam', headers: form });
    expect(bot.headers.location).toBe('/cast/c1?c=ok#comments');
    expect(state.submitted).toHaveLength(0);
    state.submitStatus = 400;
    const bad = await app.inject({ method: 'POST', url: '/comments', payload: 'type=cast&key=c1&name=ab&body=hello&website=', headers: form });
    expect(bad.headers.location).toBe('/cast/c1?c=links_not_allowed#comments');
    expect((await app.inject({ method: 'POST', url: '/comments', payload: 'type=evil&key=x', headers: form })).statusCode).toBe(400);
  });
});
