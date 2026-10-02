import { describe, expect, it } from 'vitest';
import { mulberry32, tournamentDetailSchema, tournamentListSchema } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { TournamentService } from '../tournament/service.js';
import type { TournamentInput } from '../tournament/service.js';
import { createMemoryTournamentStore } from '../tournament/store.js';

const MIN = 60_000;

function memoryUsers(): UserRepository {
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
      return user;
    },
    async touch() {},
  };
}

function boot(bots: string[] = []) {
  const clock = { ms: Date.UTC(2026, 9, 2, 12) };
  const store = createMemoryTournamentStore();
  const levels = new Map<string, number>();
  const busy = new Set<string>();
  const started: [string, string][] = [];
  const told: [string, string][] = [];
  const service = new TournamentService(store, {
    levelOf: async (id) => levels.get(id) ?? 5,
    profileOf: async (id) => ({ nickname: `بازیکن ${id.slice(-2)}`, avatarKey: 'avatar-01' }),
    startMatch: async (a, b) => {
      if (busy.has(a) || busy.has(b)) return false;
      started.push([a, b]);
      busy.add(a);
      busy.add(b);
      return true;
    },
    inMatch: (id) => busy.has(id),
    fillBots: (n) => bots.slice(0, n),
    isBot: (id) => bots.includes(id),
    notify: (id, text) => told.push([id, text]),
    now: () => clock.ms,
  });
  const auth = new AuthService(memoryUsers(), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
  const app = buildServer({ auth, tournaments: service });
  const login = async (n: number) => {
    const r = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}` } })).json() as { token: string; user: { id: string } };
    return { h: { authorization: `Bearer ${r.token}` }, id: r.user.id };
  };
  const input = (over: Partial<TournamentInput> = {}): TournamentInput => ({ titleFa: 'جام مهر', descriptionFa: 'تورنومنت آزمایشی', iconKey: 'trophy', size: 4, minPlayers: 2, entryCoins: 50, minLevel: 3, startsAt: clock.ms + 60 * MIN, prizes: [{ place: 1, coins: 120 }, { place: 2, coins: 50 }, { place: 3, coins: 10 }], ...over });
  const join = (u: { h: Record<string, string> }, id: string) => app.inject({ method: 'POST', url: `/tournaments/${id}/join`, headers: u.h });
  /** Plays every started match: `first` of the pair wins unless `winnerOf` says otherwise. */
  const finishMatches = async (winnerOf: (a: string, b: string) => number | null) => {
    for (const [a, b] of started.splice(0)) {
      busy.delete(a);
      busy.delete(b);
      await service.onMatchEnded([a, b], winnerOf(a, b) as 0 | 1 | null);
    }
  };
  return { app, store, service, clock, levels, busy, started, told, login, input, join, finishMatches };
}

describe('tournament entry', () => {
  it('lists open tournaments; joining checks level, coins, capacity and duplicates; leaving refunds', async () => {
    const t = boot();
    const a = await t.login(1);
    const b = await t.login(2);
    const created = await t.service.create(t.input(), true);
    if (!created.ok) throw new Error('create failed');
    const id = created.id;
    t.store.coins.set(a.id, 100);
    t.levels.set(b.id, 2);
    t.store.coins.set(b.id, 100);
    const list = tournamentListSchema.parse((await t.app.inject({ method: 'GET', url: '/tournaments', headers: a.h })).json());
    expect(list.tournaments[0]).toMatchObject({ titleFa: 'جام مهر', status: 'open', entryCoins: 50, minLevel: 3, joined: 0, entered: false });
    expect((await t.join(b, id)).json()).toEqual({ error: 'LEVEL' });
    expect(tournamentDetailSchema.parse((await t.app.inject({ method: 'GET', url: `/tournaments/${id}`, headers: b.h })).json()).blocked).toBe('LEVEL');
    expect((await t.join(a, id)).json()).toEqual({ ok: true, balance: 50 });
    expect((await t.join(a, id)).json()).toEqual({ error: 'ALREADY_IN' });
    const c = await t.login(3);
    expect((await t.join(c, id)).json()).toEqual({ error: 'COINS' });
    const detail = tournamentDetailSchema.parse((await t.app.inject({ method: 'GET', url: `/tournaments/${id}`, headers: a.h })).json());
    expect(detail).toMatchObject({ entered: true, joined: 1, blocked: null, rounds: 2 });
    expect(detail.prizes).toEqual([{ place: 1, coins: 120 }, { place: 2, coins: 50 }, { place: 3, coins: 10 }]);
    expect((await t.app.inject({ method: 'POST', url: `/tournaments/${id}/leave`, headers: a.h })).json()).toEqual({ ok: true, balance: 100 });
    expect((await t.app.inject({ method: 'POST', url: `/tournaments/${id}/leave`, headers: a.h })).json()).toEqual({ error: 'NOT_IN' });
  });

  it('stops at the bracket size, and a draft is invisible', async () => {
    const t = boot();
    const users = [await t.login(1), await t.login(2), await t.login(3), await t.login(4), await t.login(5)];
    for (const u of users) t.store.coins.set(u.id, 100);
    const draft = await t.service.create(t.input(), false);
    if (!draft.ok) throw new Error('x');
    expect((await t.app.inject({ method: 'GET', url: `/tournaments/${draft.id}`, headers: users[0]!.h })).statusCode).toBe(404);
    expect((await t.join(users[0]!, draft.id)).statusCode).toBe(404);
    expect((await t.service.publish(draft.id)).ok).toBe(true);
    for (const u of users.slice(0, 4)) expect((await t.join(u, draft.id)).statusCode).toBe(200);
    expect((await t.join(users[4]!, draft.id)).json()).toEqual({ error: 'FULL' });
  });

  it('validates the builder input', async () => {
    const t = boot();
    for (const bad of [t.input({ size: 6 }), t.input({ minPlayers: 1 }), t.input({ minPlayers: 9 }), t.input({ entryCoins: -1 }), t.input({ prizes: [{ place: 4, coins: 5 }] }), t.input({ prizes: [{ place: 1, coins: 5 }, { place: 1, coins: 6 }] }), t.input({ titleFa: ' ' })]) expect((await t.service.create(bad, false)).ok).toBe(false);
    expect((await t.service.create(t.input({ startsAt: t.clock.ms - 1 }), true)).ok).toBe(false); // cannot publish in the past
  });
});

describe('running a tournament', () => {
  async function fourPlayers() {
    const t = boot();
    const users = [await t.login(1), await t.login(2), await t.login(3), await t.login(4)];
    t.levels.set(users[0]!.id, 9);
    t.levels.set(users[1]!.id, 7);
    t.levels.set(users[2]!.id, 6);
    t.levels.set(users[3]!.id, 5);
    for (const u of users) t.store.coins.set(u.id, 100);
    const created = await t.service.create(t.input(), true);
    if (!created.ok) throw new Error('x');
    for (const u of users) await t.join(u, created.id);
    return { ...t, users, id: created.id };
  }

  it('starts at the start time, seeds by level, plays round by round, pays the prizes', async () => {
    const t = await fourPlayers();
    const [p1, p2, p3, p4] = t.users.map((u) => u.id) as [string, string, string, string];
    await t.service.tick();
    expect(t.started).toEqual([]); // not yet
    t.clock.ms += 61 * MIN;
    await t.service.tick();
    expect(t.started).toEqual([[p1, p4], [p2, p3]]); // 1 v 4, 2 v 3
    const live = tournamentDetailSchema.parse((await t.app.inject({ method: 'GET', url: `/tournaments/${t.id}`, headers: t.users[0]!.h })).json());
    expect(live.status).toBe('running');
    expect(live.bracket.filter((m) => m.status === 'playing')).toHaveLength(2);
    await t.finishMatches(() => 0); // first of each pair wins: p1 and p2
    await t.service.tick();
    expect(t.started).toEqual([[p1, p2]]);
    await t.finishMatches(() => 1); // p2 wins the final
    const done = tournamentDetailSchema.parse((await t.app.inject({ method: 'GET', url: `/tournaments/${t.id}`, headers: t.users[0]!.h })).json());
    expect(done.status).toBe('finished');
    expect(done.results.map((r) => [r.id, r.place, r.coins]).sort((x, y) => String(x[0]).localeCompare(String(y[0])))).toEqual([[p1, 2, 50], [p2, 1, 120], [p3, 3, 10], [p4, 3, 10]]);
    expect([p1, p2, p3, p4].map((p) => t.store.coins.get(p))).toEqual([50 + 50, 50 + 120, 50 + 10, 50 + 10]);
    expect(t.told.some(([id, text]) => id === p2 && text.includes('قهرمان'))).toBe(true);
    await t.finishMatches(() => 0);
    expect(t.store.coins.get(p2)).toBe(170); // paid once
  });

  it('a draw is replayed; a busy player is retried on the next tick', async () => {
    const t = await fourPlayers();
    const [p1, p2, p3, p4] = t.users.map((u) => u.id) as [string, string, string, string];
    t.busy.add(p2); // already in another duel
    t.clock.ms += 61 * MIN;
    await t.service.tick();
    expect(t.started).toEqual([[p1, p4]]); // p2 v p3 could not start
    await t.finishMatches(() => null); // draw
    t.busy.delete(p2);
    await t.service.tick();
    expect(t.started.map((m) => m.slice().sort().join())).toEqual([[p2, p3].sort().join(), [p1, p4].sort().join()].sort());
  });

  it('recovers a match whose live duel was lost (restart)', async () => {
    const t = await fourPlayers();
    t.clock.ms += 61 * MIN;
    await t.service.tick();
    t.busy.clear(); // the server restarted: no live matches any more
    t.started.splice(0);
    await t.service.tick();
    expect(t.started).toHaveLength(2); // restarted
  });

  it('pads with byes when fewer than the bracket size join; a bye advances at once', async () => {
    const t = boot();
    const users = [await t.login(1), await t.login(2), await t.login(3)];
    users.forEach((u, i) => (t.levels.set(u.id, 9 - i), t.store.coins.set(u.id, 100)));
    const created = await t.service.create(t.input({ size: 8, minPlayers: 3 }), true);
    if (!created.ok) throw new Error('x');
    for (const u of users) await t.join(u, created.id);
    t.clock.ms += 61 * MIN;
    await t.service.tick();
    const [p1, p2, p3] = users.map((u) => u.id) as [string, string, string];
    expect(t.started).toEqual([[p2, p3]]); // 2 v 3 is the only real round-1 match; p1 has a bye
    await t.finishMatches(() => 0);
    await t.service.tick();
    expect(t.started.flat().sort()).toEqual([p1, p2].sort()); // p1 v the winner of 2 v 3
    await t.finishMatches(() => 0); // that was the final (p1 had a bye in round 2)
    const detail = await t.service.detail(p1, created.id);
    expect(detail?.status).toBe('finished');
    expect(detail?.results[0]?.place).toBe(1);
  });

  it('cancels and refunds when too few joined; an admin can cancel an open one', async () => {
    const t = boot();
    const a = await t.login(1);
    const b = await t.login(2);
    t.store.coins.set(a.id, 100);
    t.store.coins.set(b.id, 100);
    const small = await t.service.create(t.input({ minPlayers: 3 }), true);
    if (!small.ok) throw new Error('x');
    await t.join(a, small.id);
    await t.join(b, small.id);
    t.clock.ms += 61 * MIN;
    await t.service.tick();
    expect((await t.service.detail(a.id, small.id))?.status).toBe('cancelled');
    expect([t.store.coins.get(a.id), t.store.coins.get(b.id)]).toEqual([100, 100]);
    expect(t.told.some(([, text]) => text.includes('حد نصاب'))).toBe(true);
    const other = await t.service.create(t.input({ startsAt: t.clock.ms + 60 * MIN }), true);
    if (!other.ok) throw new Error('x');
    await t.join(a, other.id);
    expect(t.store.coins.get(a.id)).toBe(50);
    expect(await t.service.cancel(other.id)).toMatchObject({ ok: true, refunded: 1 });
    expect(t.store.coins.get(a.id)).toBe(100);
    expect(await t.service.cancel(other.id)).toEqual({ ok: false, error: 'BAD_STATE' });
  });

  it('structural fields cannot change once somebody joined; startNow runs the start at once', async () => {
    const t = boot();
    const a = await t.login(1);
    const b = await t.login(2);
    t.store.coins.set(a.id, 100);
    t.store.coins.set(b.id, 100);
    const c = await t.service.create(t.input(), true);
    if (!c.ok) throw new Error('x');
    expect((await t.service.update(c.id, { entryCoins: 10 })).ok).toBe(true);
    await t.join(a, c.id);
    await t.join(b, c.id);
    expect(await t.service.update(c.id, { entryCoins: 99 })).toEqual({ ok: false, error: 'BAD_STATE' });
    expect((await t.service.update(c.id, { descriptionFa: 'متن تازه', prizes: [{ place: 1, coins: 77 }] })).ok).toBe(true);
    expect((await t.service.detail(a.id, c.id))?.prizes).toEqual([{ place: 1, coins: 77 }]);
    expect((await t.service.startNow(c.id)).ok).toBe(true);
    expect(t.started).toHaveLength(1);
  });
});

describe('bot fill', () => {
  it('fills empty seats with bots at the start, they play, and never get prize coins', async () => {
    const t = boot(['bot-1', 'bot-2']);
    const a = await t.login(1);
    const b = await t.login(2);
    t.store.coins.set(a.id, 100);
    t.store.coins.set(b.id, 100);
    const created = await t.service.create(t.input({ botFill: true, minPlayers: 2 }), true);
    if (!created.ok) throw new Error('x');
    await t.join(a, created.id);
    await t.join(b, created.id);
    t.clock.ms += 61 * MIN;
    await t.service.tick();
    const detail = await t.service.detail(a.id, created.id);
    expect(detail?.joined).toBe(4); // 2 humans + 2 bots
    expect(t.started).toHaveLength(2);
    // Bots win both round-1 matches (the first listed of each pair is the better seed; make the bots win), then the final.
    await t.finishMatches((x, y) => (['bot-1', 'bot-2'].includes(x) ? 0 : ['bot-1', 'bot-2'].includes(y) ? 1 : 0));
    await t.service.tick();
    await t.finishMatches((x) => (x === 'bot-1' ? 0 : 1));
    const done = await t.service.detail(a.id, created.id);
    expect(done?.status).toBe('finished');
    expect(t.store.coins.get('bot-1') ?? 0).toBe(0);
    expect(t.store.coins.get('bot-2') ?? 0).toBe(0);
  });
});
