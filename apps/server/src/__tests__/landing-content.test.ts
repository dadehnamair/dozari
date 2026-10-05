import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { LandingService, isSlug, slugify } from '../landing/service.js';
import { createMemoryLandingStore } from '../landing/store.js';
import { SettingsService } from '../settings/service.js';
import { createMemorySettingsStore } from '../settings/db-store.js';

const post = (over: Partial<Parameters<LandingService['savePost']>[0]> = {}) => ({ titleFa: 'قیمت نان در سال ۱۳۵۰', summaryFa: 'خلاصه', bodyMd: '## نان\nنان ارزان بود.', status: 'published' as const, ...over });

describe('slugs', () => {
  it('keeps Persian letters, joins words with dashes and drops punctuation', () => {
    expect(slugify('قیمت نان در سال ۱۳۵۰!')).toBe('قیمت-نان-در-سال-۱۳۵۰');
    expect(slugify('  Hello,  World_ok ')).toBe('hello-world-ok');
    expect(isSlug('قیمت-نان')).toBe(true);
    expect(isSlug('a')).toBe(false);
    expect(isSlug('Bad Slug')).toBe(false);
    expect(isSlug('trailing-')).toBe(false);
  });
});

describe('landing content', () => {
  it('publishes a post, hides drafts, and answers a renamed slug with a redirect', async () => {
    const landing = new LandingService(createMemoryLandingStore(), () => 1_000);
    const a = await landing.savePost(post());
    if (!a.ok) throw new Error('save failed');
    expect(a.slug).toBe('قیمت-نان-در-سال-۱۳۵۰');
    const draft = await landing.savePost(post({ titleFa: 'پیش‌نویس', status: 'draft' }));
    if (!draft.ok) throw new Error('save failed');
    expect((await landing.publicPosts(1, 10)).posts.map((p) => p.slug)).toEqual([a.slug]);
    expect(await landing.publicPost(draft.slug)).toBeNull();
    expect(await landing.savePost(post({ titleFa: 'دیگری', slug: a.slug }))).toEqual({ ok: false, error: 'slug_taken' });
    expect(await landing.savePost(post({ slug: 'bread-1350' }), a.id)).toEqual({ ok: true, id: a.id, slug: 'bread-1350' });
    expect(await landing.publicPost(a.slug)).toEqual({ redirectTo: 'bread-1350' });
    expect(await landing.publicPost('bread-1350')).toMatchObject({ post: { title: 'قیمت نان در سال ۱۳۵۰', bodyMd: expect.stringContaining('نان ارزان') } });
    expect(await landing.publicPost('never-existed')).toBeNull();
  });

  it('refuses empty posts, bad slugs and non-web cover images', async () => {
    const landing = new LandingService(createMemoryLandingStore());
    expect(await landing.savePost(post({ bodyMd: '  ' }))).toEqual({ ok: false, error: 'empty' });
    expect(await landing.savePost(post({ slug: 'Bad Slug' }))).toEqual({ ok: false, error: 'invalid_slug' });
    expect(await landing.savePost(post({ coverUrl: 'javascript:alert(1)' }))).toEqual({ ok: false, error: 'invalid_cover' });
  });

  it('serves the public API: site, cast, faq, posts, one post, 404', async () => {
    const landing = new LandingService(createMemoryLandingStore());
    const saved = await landing.savePost(post());
    if (!saved.ok) throw new Error('save failed');
    await landing.cast.add({ nameFa: 'دوزاری', roleFa: 'راهنما', bioFa: 'نگهبان بازار', imageKey: 'dozari', isActive: true });
    await landing.cast.add({ nameFa: 'پنهان', roleFa: '', bioFa: 'x', imageKey: null, isActive: false });
    await landing.faq.add({ questionFa: 'دوزاری چیست؟', answerFa: 'یک بازی فارسی است.', isActive: true });
    const settings = new SettingsService(createMemorySettingsStore());
    const app = buildServer({ landing, settings });
    const site = (await app.inject({ method: 'GET', url: '/public/landing' })).json();
    expect(site.site).toMatchObject({ name: 'دوزاری', contactEmail: null, androidApp: null, domains: { landing: 'mrdozari.ir', short: '2oi.ir' } });
    expect(site.cast).toEqual([{ id: expect.any(String), name: 'دوزاری', role: 'راهنما', bio: 'نگهبان بازار', image: 'dozari' }]);
    expect(site.faq).toEqual([{ question: 'دوزاری چیست؟', answer: 'یک بازی فارسی است.' }]);
    const list = (await app.inject({ method: 'GET', url: '/public/posts' })).json();
    expect(list).toMatchObject({ total: 1, page: 1 });
    expect(list.posts[0]).not.toHaveProperty('bodyMd');
    const one = await app.inject({ method: 'GET', url: `/public/posts/${encodeURIComponent(saved.slug)}` });
    expect(one.json().post.slug).toBe(saved.slug);
    expect((await app.inject({ method: 'GET', url: '/public/posts/none' })).statusCode).toBe(404);
  });

  it('serves the try-it puzzle as drawn icons, and 404 when the catalog has none', async () => {
    const settings = new SettingsService(createMemorySettingsStore());
    const store = createMemoryLandingStore();
    const empty = buildServer({ landing: new LandingService(store), settings });
    expect((await empty.inject({ method: 'GET', url: '/public/landing-demo' })).statusCode).toBe(404);

    const group = (level: number) => ({ level, titleFa: `گروه ${level}`, items: ['coin', 'tv', 'nokia', 'pride'].map((iconKey, n) => ({ nameFa: `کالا ${level}${n}`, iconKey })) });
    store.demoPuzzle = async () => [0, 1, 2, 3].map(group);
    const app = buildServer({ landing: new LandingService(store), settings });
    const res = (await app.inject({ method: 'GET', url: '/public/landing-demo' })).json();
    expect(res.groups).toHaveLength(4);
    expect(res.groups[0]).toMatchObject({ level: 0, title: 'گروه 0' });
    expect(res.groups[0].items[0]).toMatchObject({ name: 'کالا 00', svg: expect.stringMatching(/^<svg /) });
  });

  it('publishes the admin-set SEO fields, keeping only safe values', async () => {
    const settings = new SettingsService(createMemorySettingsStore());
    const app = buildServer({ landing: new LandingService(createMemoryLandingStore()), settings });
    const read = async () => (await app.inject({ method: 'GET', url: '/public/landing' })).json().site.seo;
    expect(await read()).toMatchObject({ title: null, description: null, keywords: [], ogImage: null, sameAs: [], fontUrl: null, indexable: true, verify: { google: null, bing: null, yandex: null } });

    await settings.set('landing.seo_title', 'عنوان من');
    await settings.set('landing.keywords', 'دوزاری، قیمت قدیم, نوستالژی');
    await settings.set('landing.og_image', 'https://cdn.example/og.png');
    await settings.set('landing.same_as', 'https://aparat.com/dozari, javascript:alert(1), https://linkedin.com/company/dozari');
    await settings.set('landing.indexable', '0');
    await settings.set('seo.verify_google', 'abc_123-XYZ');
    await settings.set('seo.verify_bing', '"><script>');
    await settings.set('analytics.script_url', 'https://stats.example.ir/script.js');
    await settings.set('analytics.site_id', 'abcd-1234');
    expect(await read()).toMatchObject({
      title: 'عنوان من',
      keywords: ['دوزاری', 'قیمت قدیم', 'نوستالژی'],
      ogImage: 'https://cdn.example/og.png',
      sameAs: ['https://aparat.com/dozari', 'https://linkedin.com/company/dozari'],
      indexable: false,
      verify: { google: 'abc_123-XYZ', bing: null, yandex: null },
      analytics: { scriptUrl: 'https://stats.example.ir/script.js', siteId: 'abcd-1234' },
    });
  });
});
