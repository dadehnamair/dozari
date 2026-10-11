import { afterEach, describe, expect, it } from 'vitest';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { liveNoticeSchema, matchFoundSchema, matchViewSchema, mulberry32, publicTablesSchema, tableViewSchema } from '@dozari/shared';
import type { LiveNotice } from '@dozari/shared';
import { buildServer } from '../index.js';
import type { ServerDeps } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { ChatService } from '../chat/service.js';
import { createMemoryChatStore } from '../chat/store.js';
import { createMemoryStakeStore } from '../duel/stakes-store.js';
import type { MatchService } from '../realtime/match-service.js';
import { createLiveNotices } from '../realtime/notices.js';
import { Presence } from '../realtime/presence.js';
import { SocialService } from '../social/service.js';
import { createMemorySocialStore } from '../social/store.js';
import type { ServedPuzzle } from '../solo/types.js';
import { TableService } from '../tables/service.js';
import { TableStakes } from '../tables/stakes.js';

/** The live parts of the app wired together on memory stores: friend requests, table invites and join requests, and the match they start, all over real sockets. */

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

const mk = (tag: string): ServedPuzzle => ({
  id: `pz-${tag}`,
  groups: ([0, 1, 2, 3] as const).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `${tag}g${level}p${i}`), titleFa: `عنوان ${tag}${level}`, explanationFa: `توضیح ${tag}${level}` })),
  items: Object.fromEntries([0, 1, 2, 3].flatMap((l) => [0, 1, 2, 3].map((i) => [`${tag}g${l}p${i}`, { nameFa: `کالا ${tag}${l}-${i}`, unitFa: null }]))),
});
const POOL = ['a', 'b', 'c', 'd'].map(mk);

const wait = async (cond: () => boolean, ms = 2000) => {
  for (let i = 0; i < ms / 20 && !cond(); i++) await new Promise((r) => setTimeout(r, 20));
};

function boot() {
  const seed: { id: string; nickname: string; avatarKey: string; createdAt: number; coins: number }[] = [];
  const socialStore = createMemorySocialStore(seed);
  const notices = createLiveNotices();
  const presence = new Presence();
  const social = new SocialService(socialStore, Date.now, (target, nick) => notices.push(target, { kind: 'friend_request', from: nick }));
  const auth = new AuthService(memoryUsers((u) => seed.push({ id: u.id, nickname: u.nickname, avatarKey: u.avatarKey, createdAt: 1_700_000_000_000, coins: 25 })), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
  const chat = new ChatService(createMemoryChatStore(), {
    cityOf: async () => null,
    profileOf: async (id) => ({ nickname: seed.find((s) => s.id === id)?.nickname ?? '؟', avatarKey: 'avatar-01' }),
    badgeTitleOf: async () => null,
    isActivated: async () => true,
    mute: async () => null,
    hasContactPerk: async () => false,
    areFriends: async () => true,
    tableMembers: (id, code) => tables.memberIds(id, code),
    rules: async () => ({ maxLen: 40, textNeedsActivation: true, enabled: true, globalEnabled: true }),
  });
  const live: NonNullable<ServerDeps['live']> = {};
  const stakeStore = createMemoryStakeStore();
  const tableStakes = new TableStakes(stakeStore);
  const tables: TableService = new TableService({
    profileOf: async (id) => ({ nickname: seed.find((s) => s.id === id)?.nickname ?? '؟', avatarKey: 'avatar-01' }),
    startMatch: async (a, b, opts) => ((live.matches as MatchService).start(a, b, { friendly: true, boards: opts?.boards, fee: opts?.fee })),
    startTeam: async (sides, opts) => (live.matches as MatchService).startTeam(sides, opts),
    inMatch: (id) => live.matches?.inMatch(id) ?? false,
    balanceOf: (id) => tableStakes.balance(id),
    notify: (id, n) => notices.push(id, n),
    idleMs: async () => 15 * 60_000,
  });
  const app = buildServer({
    auth,
    social,
    notices,
    presence,
    chat,
    tables,
    live,
    realtime: true,
    match: {
      puzzles: { pickRandom: async (o) => POOL.find((p) => !(o?.exclude ?? []).includes(p.id)) ?? null, pricesFor: async () => ({}) },
      profile: async (id) => ({ nickname: seed.find((s) => s.id === id)?.nickname ?? '؟', avatarKey: 'avatar-01', level: 1, coins: 0 }),
      tableStakes,
    },
  });
  return { app, notices, stakeStore, tables };
}

describe('live flows over real sockets', () => {
  const open: Socket[] = [];
  const apps: ReturnType<typeof buildServer>[] = [];
  afterEach(async () => {
    open.splice(0).forEach((s) => s.close());
    await Promise.all(apps.splice(0).map((a) => a.close()));
  });

  async function world(players: number) {
    const b = boot();
    b.stakeStore.balances.set('seed', 0);
    apps.push(b.app);
    await b.app.listen({ port: 0, host: '127.0.0.1' });
    const url = `http://127.0.0.1:${(b.app.server.address() as AddressInfo).port}`;
    const people: { id: string; h: { authorization: string }; s: Socket; notices: LiveNotice[]; events: { event: string; payload: unknown }[] }[] = [];
    for (let n = 1; n <= players; n++) {
      const r = (await b.app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}` } })).json() as { token: string; user: { id: string } };
      const s = connect(url, { auth: { token: r.token }, transports: ['websocket'], reconnection: false });
      open.push(s);
      const p = { id: r.user.id, h: { authorization: `Bearer ${r.token}` }, s, notices: [] as LiveNotice[], events: [] as { event: string; payload: unknown }[] };
      s.on('notice:new', (x: unknown) => p.notices.push(liveNoticeSchema.parse(x)));
      for (const event of ['chat:message', 'match:found', 'match:state', 'match:event', 'match:ended']) s.on(event, (payload: unknown) => p.events.push({ event, payload }));
      await new Promise<void>((res) => s.once('connect', () => res()));
      people.push(p);
      b.stakeStore.balances.set(p.id, 100); // everybody can pay the minimum entry
    }
    const call = async (who: (typeof people)[number], method: 'GET' | 'POST', path: string, payload?: unknown) => b.app.inject({ method, url: path, headers: who.h, payload: payload as object | undefined });
    return { ...b, people, call };
  }

  it('a friend request reaches only the addressed player, and only live', async () => {
    const w = await world(3);
    const [a, b, c] = w.people as [(typeof w.people)[number], (typeof w.people)[number], (typeof w.people)[number]];
    expect((await w.call(a, 'POST', `/friends/${b.id}/request`)).statusCode).toBe(200);
    await wait(() => b.notices.length > 0);
    expect(b.notices).toHaveLength(1);
    expect(b.notices[0]).toMatchObject({ kind: 'friend_request' });
    expect(b.notices[0]!.from).toBeTruthy();
    expect(a.notices).toHaveLength(0);
    expect(c.notices).toHaveLength(0);
  });

  it('a table invite arrives as a chat card and a live notice, several in a row', async () => {
    const w = await world(4);
    const [host, f1, f2, f3] = w.people as [(typeof w.people)[number], (typeof w.people)[number], (typeof w.people)[number], (typeof w.people)[number]];
    const made = await w.call(host, 'POST', '/tables', { name: 'میز علی', icon: 'dice', format: '1v1' });
    expect(made.statusCode).toBe(201);
    const table = tableViewSchema.parse(made.json());
    for (const f of [f1, f2, f3]) expect((await w.call(host, 'POST', '/tables/invite', { userId: f.id })).statusCode).toBe(200);
    await wait(() => [f1, f2, f3].every((f) => f.notices.length > 0 && f.events.some((e) => e.event === 'chat:message')));
    for (const f of [f1, f2, f3]) {
      expect(f.notices[0]).toMatchObject({ kind: 'table_invite', code: table.code });
      const card = f.events.find((e) => e.event === 'chat:message')!.payload as { kind: string; text: string };
      expect(card.kind).toBe('table');
      expect(card.text.startsWith(table.code)).toBe(true);
    }
  });

  it('a public table is listed, a request nudges the host, the answer nudges the asker', async () => {
    const w = await world(3);
    const [host, guest, other] = w.people as [(typeof w.people)[number], (typeof w.people)[number], (typeof w.people)[number]];
    const made = tableViewSchema.parse((await w.call(host, 'POST', '/tables', { name: 'میز باز', icon: 'crown', format: '1v1' })).json());
    expect(made.isPrivate).toBe(false);
    const list = publicTablesSchema.parse((await w.call(guest, 'GET', '/tables/public')).json());
    expect(list.tables.map((t) => [t.code, t.status, t.yourRequest])).toEqual([[made.code, 'open', 'none']]);
    expect((await w.call(guest, 'POST', `/tables/${made.code}/request`)).statusCode).toBe(200);
    await wait(() => host.notices.length > 0);
    expect(host.notices[0]).toMatchObject({ kind: 'table_request', code: made.code });
    expect(publicTablesSchema.parse((await w.call(guest, 'GET', '/tables/public')).json()).tables[0]!.yourRequest).toBe('pending');
    // only the host sees who is asking
    expect(tableViewSchema.parse((await w.call(host, 'GET', `/tables/${made.code}`)).json()).requests.map((r) => r.id)).toEqual([guest.id]);
    expect((await w.call(other, 'POST', '/tables/answer', { userId: guest.id, accept: true })).statusCode).toBe(403);
    expect((await w.call(host, 'POST', '/tables/answer', { userId: guest.id, accept: true })).statusCode).toBe(200);
    await wait(() => guest.notices.length > 0);
    expect(guest.notices[0]).toMatchObject({ kind: 'table_answer', accepted: true, code: made.code });
    expect(tableViewSchema.parse((await w.call(guest, 'GET', '/tables/mine')).json().table).players).toHaveLength(2);
    // a full table stays in the list for others, view only
    const after = publicTablesSchema.parse((await w.call(other, 'GET', '/tables/public')).json());
    expect(after.tables[0]).toMatchObject({ code: made.code, status: 'full', taken: 2 });
    expect((await w.call(other, 'POST', `/tables/${made.code}/request`)).statusCode).toBe(409);
  });

  it('a turned-down request is told so, and a private table is neither listed nor open to requests', async () => {
    const w = await world(3);
    const [host, guest, other] = w.people as [(typeof w.people)[number], (typeof w.people)[number], (typeof w.people)[number]];
    const open = tableViewSchema.parse((await w.call(host, 'POST', '/tables', { name: 'باز', icon: 'dice', format: '1v1' })).json());
    await w.call(guest, 'POST', `/tables/${open.code}/request`);
    await w.call(host, 'POST', '/tables/answer', { userId: guest.id, accept: false });
    await wait(() => guest.notices.length > 0);
    expect(guest.notices[0]).toMatchObject({ kind: 'table_answer', accepted: false });
    expect(publicTablesSchema.parse((await w.call(guest, 'GET', '/tables/public')).json()).tables[0]!.yourRequest).toBe('denied');
    const secret = tableViewSchema.parse((await w.call(other, 'POST', '/tables', { name: 'خصوصی', icon: 'star', format: '1v1', isPrivate: true })).json());
    expect(publicTablesSchema.parse((await w.call(guest, 'GET', '/tables/public')).json()).tables.map((t) => t.code)).not.toContain(secret.code);
    expect((await w.call(guest, 'POST', `/tables/${secret.code}/request`)).statusCode).toBe(404);
    // by code it still works
    expect((await w.call(guest, 'POST', `/tables/${secret.code}/join`)).statusCode).toBe(200);
  });

  it('a table of two rounds with an entry fee: both pay, both are told who plays, the winner takes the pot', async () => {
    const w = await world(2);
    const [host, guest] = w.people as [(typeof w.people)[number], (typeof w.people)[number]];
    w.stakeStore.balances.set(host.id, 100);
    w.stakeStore.balances.set(guest.id, 100);
    // two rounds need at least 20 each
    expect((await w.call(host, 'POST', '/tables', { name: 'کم', icon: 'dice', format: '1v1', rounds: 2, entryFee: 10 })).statusCode).toBe(400);
    const made = tableViewSchema.parse((await w.call(host, 'POST', '/tables', { name: 'دو دور', icon: 'dice', format: '1v1', rounds: 2, entryFee: 20 })).json());
    expect(made).toMatchObject({ rounds: 2, entryFee: 20 });
    await w.call(guest, 'POST', `/tables/${made.code}/join`);
    expect((await w.call(host, 'POST', '/tables/start')).statusCode).toBe(200);
    await wait(() => [host, guest].every((p) => p.events.some((e) => e.event === 'match:state')));
    for (const p of [host, guest]) {
      const found = matchFoundSchema.parse(p.events.find((e) => e.event === 'match:found')!.payload);
      expect(found.players).toHaveLength(2);
      const view = matchViewSchema.parse(p.events.filter((e) => e.event === 'match:state').at(-1)!.payload);
      expect(view.rounds).toBe(2);
    }
    expect(w.stakeStore.balances.get(host.id)).toBe(80);
    expect(w.stakeStore.balances.get(guest.id)).toBe(80);
    // the guest walks out: the host wins 36 of the 40 pot (10% house cut)
    const ack = await new Promise((res) => guest.s.emit('match:leave', {}, res));
    expect(ack).toEqual({ ok: true });
    await wait(() => (w.stakeStore.balances.get(host.id) ?? 0) > 80);
    expect(host.events.some((e) => e.event === 'match:ended')).toBe(true);
    expect(w.stakeStore.balances.get(host.id)).toBe(116);
    expect(w.stakeStore.balances.get(guest.id)).toBe(80);
  });

  it('a player who cannot pay the entry cannot sit, and cannot be started with', async () => {
    const w = await world(2);
    const [host, guest] = w.people as [(typeof w.people)[number], (typeof w.people)[number]];
    w.stakeStore.balances.set(host.id, 50);
    w.stakeStore.balances.set(guest.id, 5);
    const made = tableViewSchema.parse((await w.call(host, 'POST', '/tables', { name: 'گران', icon: 'dice', format: '1v1', rounds: 1, entryFee: 30 })).json());
    expect((await w.call(guest, 'POST', `/tables/${made.code}/join`)).statusCode).toBe(402);
    expect((await w.call(guest, 'POST', `/tables/${made.code}/request`)).statusCode).toBe(402);
  });
});
