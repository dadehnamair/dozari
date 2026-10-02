import { afterEach, describe, expect, it } from 'vitest';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { chatHistorySchema, chatMessageSchema, mulberry32, tauntsSchema } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { ChatService } from '../chat/service.js';
import { createMemoryChatStore } from '../chat/store.js';
import { DEFAULT_RULES, PlayerService } from '../player/service.js';
import { createMemoryPlayerStore } from '../player/store.js';
import { SocialService } from '../social/service.js';
import { createMemorySocialStore } from '../social/store.js';
import { TextFilterService } from '../textfilter/service.js';
import type { WordRow, WordStore } from '../textfilter/service.js';

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

const wordStore = (words: string[]): WordStore => {
  const rows: WordRow[] = words.map((w, i) => ({ id: String(i), word: w, key: w, severity: 'block' }));
  return { list: async () => rows } as unknown as WordStore;
};

describe('chat', () => {
  const open: Socket[] = [];
  const apps: ReturnType<typeof buildServer>[] = [];
  afterEach(async () => {
    open.splice(0).forEach((s) => s.close());
    await Promise.all(apps.splice(0).map((a) => a.close()));
  });

  async function boot(opts: { needsActivation?: boolean } = {}) {
    const seed: { id: string; nickname: string; avatarKey: string; createdAt: number; coins: number }[] = [];
    const socialStore = createMemorySocialStore(seed);
    const players = createMemoryPlayerStore();
    const player = new PlayerService(players, async () => DEFAULT_RULES);
    const store = createMemoryChatStore();
    const state = { activated: new Set<string>(), muted: new Map<string, number>(), perk: new Set<string>() };
    const chat = new ChatService(store, {
      cityOf: (id) => player.cityOf(id),
      profileOf: async (id) => socialStore.publicRow(id),
      badgeTitleOf: async (id) => (state.perk.has(id) ? 'نشان تماس' : null),
      isActivated: async (id) => state.activated.has(id),
      mute: async (id) => (state.muted.has(id) ? { until: state.muted.get(id)!, reason: 'تست' } : null),
      hasContactPerk: async (id) => state.perk.has(id),
      areFriends: async (a, b) => (await socialStore.pair(a, b))?.status === 'accepted',
      rules: async () => ({ maxLen: 40, textNeedsActivation: opts.needsActivation ?? true, enabled: true, globalEnabled: true }),
      filter: new TextFilterService(wordStore(['بد'])),
    });
    const social = new SocialService(socialStore, Date.now, undefined, player);
    const auth = new AuthService(memoryUsers((u) => seed.push({ id: u.id, nickname: u.nickname, avatarKey: u.avatarKey, createdAt: 1, coins: 0 })), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
    const app = buildServer({ auth, social, chat, realtime: true });
    apps.push(app);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    const login = async (n: number) => {
      const r = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}` } })).json() as { token: string; user: { id: string } };
      return { h: { authorization: `Bearer ${r.token}` }, id: r.user.id, token: r.token };
    };
    const inCity = async (u: { id: string }, cityIndex = 0) => player.setCity(u.id, (await players.cities())[cityIndex]!.id);
    const dial = (token: string) => {
      const s = connect(url, { auth: { token }, transports: ['websocket'], reconnection: false });
      open.push(s);
      return s;
    };
    const send = (u: { h: Record<string, string> }, payload: Record<string, unknown>) => app.inject({ method: 'POST', url: '/chat/city', headers: u.h, payload });
    return { app, login, inCity, dial, send, state, store, players, socialStore };
  }

  it('lists the canned taunts by category', async () => {
    const { app, login } = await boot();
    const a = await login(1);
    const t = tauntsSchema.parse((await app.inject({ method: 'GET', url: '/chat/taunts', headers: a.h })).json());
    expect(t.categories.map((c) => c.nameFa)).toContain('سربه‌سر');
    expect(t.categories.every((c) => c.taunts.length > 0)).toBe(true);
  });

  it('friends chat privately; strangers cannot, and the other friend sees it live', async () => {
    const { app, login, dial, socialStore } = await boot({ needsActivation: false });
    const a = await login(1);
    const b = await login(2);
    const c = await login(3);
    const send = (from: typeof a, to: typeof a, text: string) => app.inject({ method: 'POST', url: `/chat/dm/${to.id}`, headers: from.h, payload: { kind: 'text', text } });
    expect((await send(a, b, 'سلام')).json()).toEqual({ error: 'NOT_FRIENDS' });
    expect((await app.inject({ method: 'GET', url: `/chat/dm/${b.id}`, headers: a.h })).statusCode).toBe(403);
    await socialStore.createRequest(a.id, b.id);
    await socialStore.accept(b.id, a.id, 1);
    const live = new Promise<{ text: string }>((resolve) => dial(b.token).on('chat:message', resolve));
    await new Promise((r) => setTimeout(r, 100));
    expect((await send(a, b, 'سلام')).statusCode).toBe(200);
    expect((await live).text).toBe('سلام');
    const hist = (await app.inject({ method: 'GET', url: `/chat/dm/${a.id}`, headers: b.h })).json() as { messages: { text: string }[] };
    expect(hist.messages.map((m) => m.text)).toEqual(['سلام']);
    // A third player sees nothing of it.
    expect((await app.inject({ method: 'GET', url: `/chat/dm/${a.id}`, headers: c.h })).statusCode).toBe(403);
  });

  it('a dialect category is offered and accepted only for players of its city', async () => {
    const { app, login, inCity, store, players } = await boot({ needsActivation: false });
    const a = await login(1);
    const b = await login(2);
    await inCity(a, 0);
    await inCity(b, 1);
    const cityA = (await players.cities())[0]!.id;
    const cat = await store.addCategory('لهجه‌ی محلی', cityA);
    const t = (await store.addTaunt(cat.id, 'دمت گرم داداش')) as { id: string };
    const names = async (u: typeof a) => tauntsSchema.parse((await app.inject({ method: 'GET', url: '/chat/taunts', headers: u.h })).json()).categories.map((c) => c.nameFa);
    expect(await names(a)).toContain('لهجه‌ی محلی');
    expect(await names(b)).not.toContain('لهجه‌ی محلی');
    const send = (u: typeof a) => app.inject({ method: 'POST', url: '/chat/city', headers: u.h, payload: { kind: 'taunt', tauntId: t.id } });
    expect((await send(a)).statusCode).toBe(200);
    expect((await send(b)).json()).toEqual({ error: 'UNKNOWN_TAUNT' });
  });

  it('needs a city; the city room shows only that city\'s messages', async () => {
    const { app, login, inCity, send } = await boot({ needsActivation: false });
    const a = await login(1);
    const b = await login(2);
    const c = await login(3);
    expect((await app.inject({ method: 'GET', url: '/chat/city', headers: a.h })).statusCode).toBe(409);
    expect((await send(a, { kind: 'text', text: 'سلام' })).json()).toEqual({ error: 'NO_CITY' });
    await inCity(a, 0);
    await inCity(b, 0);
    await inCity(c, 1);
    expect((await send(a, { kind: 'text', text: 'سلام همشهری' })).statusCode).toBe(200);
    const mine = chatHistorySchema.parse((await app.inject({ method: 'GET', url: '/chat/city', headers: b.h })).json());
    expect(mine.cityName).toBe('تهران');
    expect(mine.messages.map((m) => m.text)).toEqual(['سلام همشهری']);
    expect(chatHistorySchema.parse((await app.inject({ method: 'GET', url: '/chat/city', headers: c.h })).json()).messages).toEqual([]);
  });

  it('the global room is open to everyone, with or without a city, and carries the sender\'s province', async () => {
    const { app, login, inCity } = await boot({ needsActivation: false });
    const a = await login(1);
    const b = await login(2);
    await inCity(a, 0);
    const post = (u: typeof a, text: string) => app.inject({ method: 'POST', url: '/chat/global', headers: u.h, payload: { kind: 'text', text } });
    expect((await post(a, 'سلام همه')).statusCode).toBe(200);
    expect((await post(b, 'سلام از بی‌شهر')).statusCode).toBe(200);
    const seen = chatHistorySchema.parse((await app.inject({ method: 'GET', url: '/chat/global', headers: b.h })).json());
    expect(seen.messages.map((m) => [m.room, m.text, m.province])).toEqual([['global', 'سلام همه', 'tehran'], ['global', 'سلام از بی‌شهر', null]]);
    expect(seen.globalOn).toBe(true);
    // The city room does not see global messages.
    expect(chatHistorySchema.parse((await app.inject({ method: 'GET', url: '/chat/city', headers: a.h })).json()).messages).toEqual([]);
  });

  it('free text needs an activated account; a canned taunt does not', async () => {
    const { app, login, inCity, send, state } = await boot();
    const a = await login(1);
    await inCity(a);
    expect((await send(a, { kind: 'text', text: 'سلام' })).json()).toEqual({ error: 'NEEDS_ACTIVATION' });
    const taunt = tauntsSchema.parse((await app.inject({ method: 'GET', url: '/chat/taunts', headers: a.h })).json()).categories[0]!.taunts[0]!;
    const sent = await send(a, { kind: 'taunt', tauntId: taunt.id });
    expect(chatMessageSchema.parse((sent.json() as { message: unknown }).message)).toMatchObject({ kind: 'taunt', text: taunt.text, room: 'city' });
    expect(chatHistorySchema.parse((await app.inject({ method: 'GET', url: '/chat/city', headers: a.h })).json()).canType).toBe(false);
    state.activated.add(a.id);
    expect((await send(a, { kind: 'text', text: 'سلام' })).statusCode).toBe(200);
    const b = await login(2);
    await inCity(b);
    expect((await send(b, { kind: 'taunt', tauntId: '00000000-0000-7000-8000-0000000000ff' })).json()).toEqual({ error: 'UNKNOWN_TAUNT' });
  });

  it('refuses long, empty, bad-word and contact messages — the contact badge lifts only the last', async () => {
    const { login, inCity, send, state } = await boot();
    const a = await login(1);
    await inCity(a);
    state.activated.add(a.id);
    expect((await send(a, { kind: 'text', text: 'ا'.repeat(41) })).json()).toEqual({ error: 'TOO_LONG' });
    expect((await send(a, { kind: 'text', text: '   ' })).json()).toEqual({ error: 'EMPTY' });
    expect((await send(a, { kind: 'text', text: 'تو آدم بدی هستی' })).json()).toEqual({ error: 'FILTERED' });
    expect((await send(a, { kind: 'text', text: 'زنگ بزن ۰۹۱۲۳۴۵۶۷۸۹' })).json()).toEqual({ error: 'CONTACT_BLOCKED' });
    state.perk.add(a.id);
    const ok = await send(a, { kind: 'text', text: 'زنگ بزن ۰۹۱۲۳۴۵۶۷۸۹' });
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as { message: { badge: string } }).message.badge).toBe('نشان تماس');
    const b = await login(2);
    await inCity(b);
    state.activated.add(b.id);
    state.perk.add(b.id);
    expect((await send(b, { kind: 'text', text: 'تو آدم بدی هستی' })).json()).toEqual({ error: 'FILTERED' }); // the badge never lifts the filter
  });

  it('a muted player cannot send anything and sees why; the flood limit applies', async () => {
    const { app, login, inCity, send, state } = await boot();
    const a = await login(1);
    await inCity(a);
    state.activated.add(a.id);
    for (let i = 0; i < 5; i++) expect((await send(a, { kind: 'text', text: `پیام ${i}` })).statusCode).toBe(200);
    expect((await send(a, { kind: 'text', text: 'ششم' })).json()).toEqual({ error: 'RATE_LIMITED' });
    const b = await login(2);
    await inCity(b);
    state.activated.add(b.id);
    state.muted.set(b.id, Date.now() + 600_000);
    const res = await send(b, { kind: 'text', text: 'سلام' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: 'MUTED' });
    const h = chatHistorySchema.parse((await app.inject({ method: 'GET', url: '/chat/city', headers: b.h })).json());
    expect(h).toMatchObject({ canType: false, muted: { reason: 'تست' } });
  });

  it('reports a message once; not your own; the admin store sees it', async () => {
    const { app, login, inCity, send, state, store } = await boot({ needsActivation: false });
    void state;
    const a = await login(1);
    const b = await login(2);
    await inCity(a);
    await inCity(b);
    const msg = ((await send(a, { kind: 'text', text: 'یک پیام' })).json() as { message: { id: string } }).message;
    const report = (u: { h: Record<string, string> }) => app.inject({ method: 'POST', url: '/chat/report', headers: u.h, payload: { messageId: msg.id, reason: 'مزاحمت' } });
    expect((await report(a)).statusCode).toBe(400);
    expect((await report(b)).statusCode).toBe(200);
    expect((await report(b)).statusCode).toBe(409);
    expect((await store.reports({ openOnly: true, limit: 10 }))[0]).toMatchObject({ messageText: 'یک پیام', reason: 'مزاحمت' });
    expect(await store.removeMessage(msg.id)).toBe(true);
    expect(chatHistorySchema.parse((await app.inject({ method: 'GET', url: '/chat/city', headers: a.h })).json()).messages).toEqual([]);
  });

  it('pushes a new city message live to sockets that joined the room — and only those', async () => {
    const { login, inCity, dial, send, state } = await boot({ needsActivation: false });
    void state;
    const a = await login(1);
    const b = await login(2);
    const c = await login(3);
    await inCity(a, 0);
    await inCity(b, 0);
    await inCity(c, 1);
    const sb = dial(b.token);
    const sc = dial(c.token);
    await Promise.all([new Promise<void>((r) => sb.once('connect', () => r())), new Promise<void>((r) => sc.once('connect', () => r()))]);
    expect(await sb.emitWithAck('chat:join', {})).toEqual({ ok: true });
    expect(await sc.emitWithAck('chat:join', {})).toEqual({ ok: true });
    const got: string[] = [];
    sb.on('chat:message', (m: { text: string }) => got.push(`b:${m.text}`));
    sc.on('chat:message', (m: { text: string }) => got.push(`c:${m.text}`));
    await send(a, { kind: 'text', text: 'سلام تهران' });
    await new Promise<void>((r) => setTimeout(r, 100));
    expect(got).toEqual(['b:سلام تهران']);
  });

  it('a duel taunt needs a match', async () => {
    const { login, dial } = await boot();
    const a = await login(1);
    const s = dial(a.token);
    await new Promise<void>((r) => s.once('connect', () => r()));
    expect(await s.emitWithAck('chat:taunt', { tauntId: '00000000-0000-7000-8000-000000000001' })).toEqual({ ok: false, error: 'NOT_IN_MATCH' });
    expect(await s.emitWithAck('chat:taunt', { tauntId: 'x' })).toEqual({ ok: false, error: 'INVALID_PAYLOAD' });
  });
});
