import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { ShortLinkService, cleanTarget } from '../shortlinks/service.js';
import { createMemoryShortLinkStore } from '../shortlinks/store.js';
import { handleShortHost } from '../shortlinks/routes.js';

const boot = (shortHost = '2oi.ir', appHost = '2oi.ir') => {
  const store = createMemoryShortLinkStore();
  return { store, links: new ShortLinkService(store, async () => shortHost, async () => appHost) };
};

describe('short links', () => {
  it('only accepts plain web addresses', () => {
    expect(cleanTarget('https://mrdozari.ir/blog?a=1')).toBe('https://mrdozari.ir/blog?a=1');
    expect(cleanTarget('javascript:alert(1)')).toBeNull();
    expect(cleanTarget('https://user:pw@evil.test/')).toBeNull();
    expect(cleanTarget('not a url')).toBeNull();
    expect(cleanTarget(`https://x.test/${'a'.repeat(1000)}`)).toBeNull();
  });

  it('makes a code, refuses duplicates, reserved words and loops, and counts clicks', async () => {
    const { links, store } = boot();
    const auto = await links.create('https://2oi.ir/app', undefined, 'poster');
    expect(auto.ok && auto.code).toMatch(/^[a-z2-9]{6}$/);
    expect(await links.create('https://2oi.ir/dl', 'dl', '')).toEqual({ ok: true, code: 'dl' });
    expect(await links.create('https://2oi.ir/x', 'DL', '')).toEqual({ ok: false, error: 'taken' });
    expect(await links.create('https://2oi.ir/x', 'admin', '')).toEqual({ ok: false, error: 'reserved' });
    expect(await links.create('https://2oi.ir/x', 'a', '')).toEqual({ ok: false, error: 'invalid_code' });
    expect(await links.create('https://2oi.ir/s/dl', undefined, '')).toEqual({ ok: false, error: 'self_link' });
    expect(await links.create('ftp://x', undefined, '')).toEqual({ ok: false, error: 'invalid_url' });
    expect(await links.resolve('dl')).toBe('https://2oi.ir/dl');
    expect(await links.resolve('DL')).toBe('https://2oi.ir/dl');
    await new Promise((r) => setTimeout(r, 5));
    expect((await store.get('dl'))?.clicks).toBe(2);
  });

  it('with a separate short domain, any target on it is a loop; the web app domain is free', async () => {
    const { links } = boot('s.2oi.ir', '2oi.ir');
    expect(await links.create('https://s.2oi.ir/x', undefined, '')).toEqual({ ok: false, error: 'self_link' });
    expect((await links.create('https://2oi.ir/app', 'app', '')).ok).toBe(true);
  });

  it('a switched-off or unknown code resolves to nothing', async () => {
    const { links, store } = boot();
    await links.create('https://2oi.ir/dl', 'dl', '');
    await store.update('dl', { isActive: false });
    expect(await links.resolve('dl')).toBeNull();
    expect(await links.resolve('nope')).toBeNull();
    expect(await links.resolve('../etc')).toBeNull();
  });

  it('answers on the short host: home redirect, code redirect, otherwise 404', async () => {
    const { links } = boot();
    await links.create('https://2oi.ir/dl', 'dl', '');
    expect(await handleShortHost(links, '/', 'https://mrdozari.ir')).toEqual({ status: 302, location: 'https://mrdozari.ir' });
    expect(await handleShortHost(links, '/', null)).toEqual({ status: 404 });
    expect(await handleShortHost(links, '/dl', null)).toEqual({ status: 302, location: 'https://2oi.ir/dl' });
    expect(await handleShortHost(links, '/dl/', null)).toEqual({ status: 302, location: 'https://2oi.ir/dl' });
    expect(await handleShortHost(links, '/zzz', null)).toEqual({ status: 404 });
  });

  it('serves /s/:code as a 302 with no caching', async () => {
    const { links } = boot();
    await links.create('https://2oi.ir/dl', 'dl', '');
    const app = buildServer({ shortLinks: links });
    const ok = await app.inject({ method: 'GET', url: '/s/dl' });
    expect(ok.statusCode).toBe(302);
    expect(ok.headers.location).toBe('https://2oi.ir/dl');
    expect(ok.headers['cache-control']).toBe('no-store');
    expect((await app.inject({ method: 'GET', url: '/s/missing' })).statusCode).toBe(404);
  });
});
