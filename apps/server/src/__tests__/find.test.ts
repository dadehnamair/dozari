import { describe, expect, it } from 'vitest';
import { contactsResultSchema, mulberry32, myFindSchema, searchResultSchema } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { FindService } from '../find/service.js';
import type { FindSettings } from '../find/service.js';
import { createShortener, extractShortUrl } from '../find/shortener.js';
import { createMemoryFindStore } from '../find/store.js';
import { SocialService } from '../social/service.js';
import { createMemorySocialStore } from '../social/store.js';

const DAY = 86_400_000;

function memoryUsers(onCreate: (u: UserRecord) => void): UserRepository {
  const byId = new Map<string, UserRecord & { deviceId: string }>();
  return {
    async findByDeviceId(d) {
      return [...byId.values()].find((u) => u.deviceId === d) ?? null;
    },
    async findById(id) {
      return byId.get(id) ?? null;
    },
    async createGuest(deviceId, identity) {
      const user = { id: `00000000-0000-7000-8000-${String(byId.size + 1).padStart(12, '0')}`, deviceId, ...identity, isBanned: false };
      byId.set(user.id, user);
      onCreate(user);
      return user;
    },
    async touch() {},
  };
}

function boot(over: Partial<FindSettings> = {}, fetchImpl?: typeof fetch) {
  const clock = { ms: Date.UTC(2026, 9, 2, 12) };
  const seed: { id: string; nickname: string; avatarKey: string; createdAt: number; coins: number }[] = [];
  const socialStore = createMemorySocialStore(seed);
  const social = new SocialService(socialStore, () => clock.ms);
  const store = createMemoryFindStore();
  const settings: FindSettings = { inviteBase: 'dozari://i/', shortenerUrl: '', autoFriendHours: 24, autoFriendPerDay: 2, ...over };
  const find = new FindService(store, socialStore, async () => settings, createShortener({ fetchImpl, resolve: async () => ['93.184.216.34'] }), mulberry32(11), () => clock.ms);
  const auth = new AuthService(memoryUsers((u) => seed.push({ id: u.id, nickname: u.nickname, avatarKey: u.avatarKey, createdAt: clock.ms, coins: 0 })), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
  const app = buildServer({ auth, social, find });
  const login = async (n: number) => {
    const r = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}` } })).json() as { token: string; user: { id: string } };
    return { h: { authorization: `Bearer ${r.token}` }, id: r.user.id };
  };
  const me = async (u: { h: Record<string, string> }) => myFindSchema.parse((await app.inject({ method: 'GET', url: '/me/find', headers: u.h })).json());
  return { app, login, store, clock, seed, me, settings };
}

describe('public ID and search', () => {
  it('gives every player one stable ID and finds exactly that player', async () => {
    const { app, login, me } = boot();
    const a = await login(1);
    const b = await login(2);
    const mine = await me(b);
    expect(mine.handle).toMatch(/^[2-9A-HJKMNP-Z]{7}$/);
    expect((await me(b)).handle).toBe(mine.handle);
    expect(mine).toMatchObject({ inviteUrl: `dozari://i/${mine.handle}`, shareUrl: `dozari://i/${mine.handle}`, findableByPhone: true });
    const found = searchResultSchema.parse((await app.inject({ method: 'GET', url: `/players/search?q=${mine.handle.toLowerCase()}`, headers: a.h })).json());
    expect(found.player).toMatchObject({ id: b.id, relation: 'none' });
    expect(searchResultSchema.parse((await app.inject({ method: 'GET', url: '/players/search?q=ZZZZZZZ', headers: a.h })).json()).player).toBeNull();
    expect(searchResultSchema.parse((await app.inject({ method: 'GET', url: `/players/search?q=${(await me(a)).handle}`, headers: a.h })).json()).player).toBeNull(); // not yourself
    expect((await app.inject({ method: 'GET', url: '/players/search?q=x' })).statusCode).toBe(401);
  });

  it('finds by verified phone only when the owner allows it, and never reveals the number', async () => {
    const { app, login, store, me } = boot();
    const a = await login(1);
    const b = await login(2);
    await me(b);
    store.phones.set('+989123456789', b.id);
    const q = (phone: string) => app.inject({ method: 'GET', url: `/players/search?q=${encodeURIComponent(phone)}`, headers: a.h });
    const hit = await q('۰۹۱۲-۳۴۵-۶۷۸۹');
    expect(searchResultSchema.parse(hit.json()).player?.id).toBe(b.id);
    expect(JSON.stringify(hit.json())).not.toContain('9123456789');
    await app.inject({ method: 'PUT', url: '/me/find', headers: b.h, payload: { findableByPhone: false } });
    expect(searchResultSchema.parse((await q('09123456789')).json()).player).toBeNull(); // looks like an unknown number
    expect(searchResultSchema.parse((await q('09350000000')).json()).player).toBeNull();
  });

  it('rate-limits searching', async () => {
    const { app, login } = boot();
    const a = await login(1);
    for (let i = 0; i < 20; i++) await app.inject({ method: 'GET', url: '/players/search?q=ZZZZZZZ', headers: a.h });
    expect((await app.inject({ method: 'GET', url: '/players/search?q=ZZZZZZZ', headers: a.h })).statusCode).toBe(429);
  });
});

describe('contacts', () => {
  it('returns the players among the numbers, deduplicated, skipping hidden ones and yourself', async () => {
    const { app, login, store } = boot();
    const a = await login(1);
    const b = await login(2);
    const c = await login(3);
    store.phones.set('+989121111111', b.id);
    store.phones.set('+989122222222', c.id);
    store.phones.set('+989123333333', a.id);
    await app.inject({ method: 'PUT', url: '/me/find', headers: c.h, payload: { findableByPhone: false } });
    const res = await app.inject({ method: 'POST', url: '/friends/find-contacts', headers: a.h, payload: { phones: ['0912 111 1111', '+989121111111', '09122222222', '09123333333', 'not a number', '021123'] } });
    expect(contactsResultSchema.parse(res.json()).players.map((p) => p.id)).toEqual([b.id]);
    expect((await app.inject({ method: 'POST', url: '/friends/find-contacts', headers: a.h, payload: { phones: new Array(501).fill('09121111111') } })).statusCode).toBe(400);
  });
});

describe('invite link', () => {
  it('makes a brand-new account a friend at once; an older account sends a normal request', async () => {
    const { app, login, clock, me, seed } = boot();
    const owner = await login(1);
    const fresh = await login(2);
    const old = await login(3);
    seed.find((s) => s.id === old.id)!.createdAt = clock.ms - 3 * DAY;
    const link = (u: { h: Record<string, string> }, handle: string) => app.inject({ method: 'POST', url: '/friends/link', headers: u.h, payload: { handle } });
    const { handle } = await me(owner);
    expect((await link(fresh, handle)).json()).toEqual({ status: 'friends' });
    expect((await app.inject({ method: 'GET', url: '/friends', headers: owner.h })).json()).toMatchObject({ friends: [{ id: fresh.id }] });
    expect((await link(fresh, handle)).json()).toEqual({ status: 'already' });
    expect((await link(old, handle)).json()).toEqual({ status: 'sent' });
    expect((await app.inject({ method: 'GET', url: '/friends', headers: owner.h })).json()).toMatchObject({ incoming: [{ id: old.id }] });
    expect((await link(owner, handle)).statusCode).toBe(400);
    expect((await link(fresh, 'ZZZZZZZ')).statusCode).toBe(404);
  });

  it('caps instant friendships per link owner per day', async () => {
    const { app, login, me, clock } = boot({ autoFriendPerDay: 2 });
    const owner = await login(1);
    const { handle } = await me(owner);
    const out: number[] = [];
    for (const n of [2, 3, 4]) out.push((await app.inject({ method: 'POST', url: '/friends/link', headers: (await login(n)).h, payload: { handle } })).statusCode);
    expect(out).toEqual([200, 200, 429]);
    clock.ms += DAY;
    expect((await app.inject({ method: 'POST', url: '/friends/link', headers: (await login(5)).h, payload: { handle } })).statusCode).toBe(200);
  });

  it('shortens the share link through the configured service and falls back to the long one', async () => {
    const calls: string[] = [];
    const okFetch = (async (u: string) => (calls.push(u), { ok: true, text: async () => JSON.stringify({ ok: true, data: { short_url: 'https://s.ir/ab12' } }) })) as unknown as typeof fetch;
    const t = boot({ shortenerUrl: 'https://short.example/api?url={url}' }, okFetch);
    const a = await t.login(1);
    const mine = await t.me(a);
    expect(mine.shareUrl).toBe('https://s.ir/ab12');
    expect(calls[0]).toBe(`https://short.example/api?url=${encodeURIComponent(mine.inviteUrl)}`);
    await t.me(a);
    expect(calls).toHaveLength(1); // remembered
    const bad = boot({ shortenerUrl: 'https://short.example/api?url={url}' }, (async () => { throw new Error('down'); }) as unknown as typeof fetch);
    const b = await bad.login(1);
    const m = await bad.me(b);
    expect(m.shareUrl).toBe(m.inviteUrl);
  });
});

describe('shortener internals', () => {
  it('reads the short link from text or JSON', () => {
    expect(extractShortUrl('https://s.ir/x')).toBe('https://s.ir/x');
    expect(extractShortUrl('{"short_url":"https://s.ir/x"}')).toBe('https://s.ir/x');
    expect(extractShortUrl('{"result":{"shortUrl":"https://s.ir/y"}}')).toBe('https://s.ir/y');
    expect(extractShortUrl('{"error":"nope"}')).toBeNull();
    expect(extractShortUrl('javascript:alert(1)')).toBeNull();
  });
  it('refuses a private target (SSRF) and a template without {url}', async () => {
    let called = false;
    const f = (async () => ((called = true), { ok: true, text: async () => 'https://s.ir/x' })) as unknown as typeof fetch;
    const s = createShortener({ fetchImpl: f, resolve: async () => ['10.0.0.5'] });
    expect(await s.shorten('dozari://i/ABC', 'https://internal.example/?u={url}')).toBe('dozari://i/ABC');
    expect(await createShortener({ fetchImpl: f }).shorten('dozari://i/ABC', 'https://x.example/')).toBe('dozari://i/ABC');
    expect(called).toBe(false);
  });
});
