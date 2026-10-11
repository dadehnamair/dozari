import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { LandingService } from '../landing/service.js';
import { createMemoryLandingStore } from '../landing/store.js';
import { createMemorySettingsStore } from '../settings/db-store.js';
import { SettingsService } from '../settings/service.js';

async function setup(filter?: ConstructorParameters<typeof LandingService>[2]) {
  const landing = new LandingService(createMemoryLandingStore(), () => 5_000, filter);
  const saved = await landing.savePost({ titleFa: 'قیمت نان', summaryFa: '', bodyMd: '## نان\nارزان بود.', status: 'published' });
  const draft = await landing.savePost({ titleFa: 'پیش‌نویس', summaryFa: '', bodyMd: 'x', status: 'draft' });
  if (!saved.ok || !draft.ok) throw new Error('save failed');
  const castRow = await landing.cast.add({ nameFa: 'خاله', roleFa: '', bioFa: 'x', imageKey: 'khale', isActive: true });
  const hidden = await landing.cast.add({ nameFa: 'پنهان', roleFa: '', bioFa: 'x', imageKey: null, isActive: false });
  const app = buildServer({ landing, settings: new SettingsService(createMemorySettingsStore()) });
  return { landing, app, slug: saved.slug, draft: draft.slug, castId: castRow.id, hiddenId: hidden.id };
}
const send = (app: Awaited<ReturnType<typeof setup>>['app'], body: unknown, visitor = '1.1.1.1') => app.inject({ method: 'POST', url: '/public/comments', payload: body as object, headers: { 'x-visitor': visitor } });

describe('landing comments', () => {
  it('holds a new comment until an admin approves it, then shows it publicly', async () => {
    const { app, landing, slug } = await setup();
    const res = await send(app, { type: 'post', key: slug, name: ' علی  رضایی ', body: 'نان سنگک یادش بخیر' });
    expect(res.statusCode).toBe(202);
    expect((await app.inject({ method: 'GET', url: `/public/comments?type=post&key=${encodeURIComponent(slug)}` })).json().comments).toEqual([]);
    const [pending] = await landing.adminComments('pending');
    expect(pending).toMatchObject({ authorName: 'علی رضایی', status: 'pending', createdAt: 5_000 });
    expect(await landing.setCommentStatus(pending!.id, 'approved')).toBe('ok');
    const shown = (await app.inject({ method: 'GET', url: `/public/comments?type=post&key=${encodeURIComponent(slug)}` })).json().comments;
    expect(shown).toEqual([{ id: pending!.id, author: 'علی رضایی', body: 'نان سنگک یادش بخیر', createdAt: 5_000 }]);
    expect((await app.inject({ method: 'GET', url: '/public/comment-counts?type=post' })).json().counts).toEqual({ [slug]: 1 });
    await landing.setCommentStatus(pending!.id, 'hidden');
    expect((await app.inject({ method: 'GET', url: `/public/comments?type=post&key=${encodeURIComponent(slug)}` })).json().comments).toEqual([]);
    expect(await landing.setCommentStatus('00000000-0000-7000-d000-00000000ffff', 'approved')).toBe('not_found');
  });

  it('accepts comments only for published posts and visible cast members', async () => {
    const { app, castId, hiddenId, draft } = await setup();
    expect((await send(app, { type: 'cast', key: castId, name: 'مریم', body: 'خاله عالیه' })).statusCode).toBe(202);
    expect((await send(app, { type: 'cast', key: hiddenId, name: 'مریم', body: 'خاله عالیه' })).statusCode).toBe(404);
    expect((await send(app, { type: 'post', key: draft, name: 'مریم', body: 'سلام سلام' })).statusCode).toBe(404);
    expect((await send(app, { type: 'post', key: 'nope', name: 'مریم', body: 'سلام سلام' })).statusCode).toBe(404);
    expect((await send(app, { type: 'user', key: 'x', name: 'مریم', body: 'سلام' })).statusCode).toBe(400);
  });

  it('rejects links, bad lengths and blocked words', async () => {
    const { app, slug } = await setup(async (t) => (t.includes('بد') ? { ok: false } : { ok: true, text: t }));
    const code = async (name: string, body: string) => ({ status: (await send(app, { type: 'post', key: slug, name, body })).statusCode });
    expect(await code('علی', 'بیا www.spam.com')).toEqual({ status: 400 });
    expect(await code('علی', 'سایت https://x.ir')).toEqual({ status: 400 });
    expect(await code('علی', 'ab')).toEqual({ status: 400 });
    expect(await code('ع', 'متن درست')).toEqual({ status: 400 });
    expect(await code('علی', 'حرف بد')).toEqual({ status: 400 });
    const err = (await send(app, { type: 'post', key: slug, name: 'علی', body: 'حرف بد' })).json();
    expect(err.error).toBe('blocked_word');
    expect(await code('علی', 'متن مهربان')).toEqual({ status: 202 });
  });

  it('limits one visitor to a few comments per window, per visitor', async () => {
    const { app, slug } = await setup();
    const ok = async (v: string) => (await send(app, { type: 'post', key: slug, name: 'علی', body: 'نظر من' }, v)).statusCode;
    expect([await ok('a'), await ok('a'), await ok('a')]).toEqual([202, 202, 202]);
    const blocked = await send(app, { type: 'post', key: slug, name: 'علی', body: 'نظر من' }, 'a');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(await ok('b')).toBe(202);
  });
});

describe('landing status and stats', () => {
  it('answers /public/stats and /public/status', async () => {
    const { app } = await setup();
    const stats = (await app.inject({ method: 'GET', url: '/public/stats' })).json();
    expect(stats).toMatchObject({ players: 0, posts: 1, years: null });
    const status = (await app.inject({ method: 'GET', url: '/public/status' })).json();
    expect(status).toMatchObject({ api: 'ok', db: 'ok', maintenance: false });
    expect(status.uptimeSec).toBeGreaterThanOrEqual(0);
  });
});
