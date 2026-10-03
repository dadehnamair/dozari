import { describe, expect, it } from 'vitest';
import { citiesSchema, leaderboardSchema, mulberry32, myProfileSchema, playerProfileSchema } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { DEFAULT_RULES, PlayerService } from '../player/service.js';
import { createMemoryPlayerStore } from '../player/store.js';
import { SocialService } from '../social/service.js';
import { createMemorySocialStore } from '../social/store.js';
import { SoloService } from '../solo/service.js';
import type { ServedPuzzle } from '../solo/types.js';
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
  return { list: async () => rows, add: async () => 'duplicate', setSeverity: async () => 'ok', remove: async () => 'ok' } as unknown as WordStore;
};

function boot(unlockGames = 0) {
  const seed: { id: string; nickname: string; avatarKey: string; createdAt: number; coins: number }[] = [];
  const clock = { t: Date.now() };
  const store = createMemoryPlayerStore(undefined, () => clock.t);
  const player = new PlayerService(store, async () => ({ ...DEFAULT_RULES, nicknameUnlockGames: unlockGames }), new TextFilterService(wordStore(['بد'])));
  const social = new SocialService(createMemorySocialStore(seed), () => clock.t, undefined, player);
  const auth = new AuthService(memoryUsers((u) => seed.push({ id: u.id, nickname: u.nickname, avatarKey: u.avatarKey, createdAt: 1_700_000_000_000, coins: 0 })), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
  const puzzle: ServedPuzzle = {
    id: 'pz',
    groups: ([0, 1, 2, 3] as const).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`), titleFa: 't', explanationFa: 'e' })),
    items: Object.fromEntries([0, 1, 2, 3].flatMap((l) => [0, 1, 2, 3].map((i) => [`g${l}p${i}`, { nameFa: 'x', unitFa: null }]))),
  };
  const solo = new SoloService({ pickRandom: async () => puzzle, pricesFor: async () => ({}) }, { onFinished: (id, outcome) => void player.recordGame(id, { mode: 'solo', outcome }) });
  const app = buildServer({ auth, social, solo });
  const login = async (n: number) => {
    const r = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}` } })).json() as { token: string; user: { id: string } };
    return { h: { authorization: `Bearer ${r.token}` }, id: r.user.id };
  };
  return { app, login, store, solo, player, clock };
}

describe('stats and level from finished games', () => {
  it('a signed-in solo win adds a game, a win and XP; the profile shows the level', async () => {
    const { app, login, player } = boot();
    const a = await login(1);
    const start = (await app.inject({ method: 'POST', url: '/solo/start', headers: a.h })).json() as { sessionId: string };
    for (const level of [0, 1, 2, 3]) await app.inject({ method: 'POST', url: `/solo/${start.sessionId}/guess`, payload: { productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`) } });
    await new Promise((r) => setTimeout(r, 10));
    const { level, stats } = await player.levelOf(a.id);
    expect(stats).toEqual({ games: 1, wins: 1, losses: 0, draws: 0 });
    expect(level).toMatchObject({ level: 1, xp: 20 });
    const mine = myProfileSchema.parse((await app.inject({ method: 'GET', url: '/me/profile', headers: a.h })).json());
    expect(mine.stats.games).toBe(1);
    const pub = playerProfileSchema.parse((await app.inject({ method: 'GET', url: `/players/${a.id}`, headers: a.h })).json());
    expect(pub.stats.wins).toBe(1);
  });

  it('an anonymous solo game records nothing, and a game is counted once', async () => {
    const { app, login, player } = boot();
    const a = await login(1);
    const anon = (await app.inject({ method: 'POST', url: '/solo/start' })).json() as { sessionId: string };
    for (const level of [0, 1, 2, 3]) await app.inject({ method: 'POST', url: `/solo/${anon.sessionId}/guess`, payload: { productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`) } });
    expect((await player.levelOf(a.id)).stats.games).toBe(0);
    await player.recordGame(a.id, { mode: 'duel', outcome: 'loss' });
    expect((await player.levelOf(a.id)).level.xp).toBe(10);
  });

  it('levels up as XP grows', async () => {
    const { login, player } = boot();
    const a = await login(1);
    for (let i = 0; i < 2; i++) await player.recordGame(a.id, { mode: 'duel', outcome: 'win' }); // 25 + 25 = 50
    expect((await player.levelOf(a.id)).level.level).toBe(2);
  });
});

describe('city and e-mail', () => {
  it('lists cities and stores the choice; an unknown city is refused; public profile shows only the city name', async () => {
    const { app, login } = boot();
    const a = await login(1);
    const b = await login(2);
    const cities = citiesSchema.parse((await app.inject({ method: 'GET', url: '/cities', headers: a.h })).json()).cities;
    expect(cities.length).toBeGreaterThan(20);
    const tehran = cities.find((c) => c.nameFa === 'تهران')!;
    expect((await app.inject({ method: 'PUT', url: '/me/city', headers: a.h, payload: { cityId: tehran.id } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PUT', url: '/me/city', headers: a.h, payload: { cityId: '00000000-0000-7000-8000-0000000000ff' } })).json()).toEqual({ error: 'unknown_city' });
    expect(myProfileSchema.parse((await app.inject({ method: 'GET', url: '/me/profile', headers: a.h })).json()).city).toEqual(tehran);
    const pub = playerProfileSchema.parse((await app.inject({ method: 'GET', url: `/players/${a.id}`, headers: b.h })).json());
    expect([pub.cityName, pub.cityProvince]).toEqual(['تهران', 'tehran']);
    expect(tehran.province).toBe('tehran');
    expect(cities.find((c) => c.nameFa === 'تورنتو')?.province).toBe('toronto');
    expect((await app.inject({ method: 'PUT', url: '/me/city', headers: a.h, payload: { cityId: null } })).statusCode).toBe(200);
  });

  it('e-mail is optional, validated, private', async () => {
    const { app, login } = boot();
    const a = await login(1);
    const b = await login(2);
    expect((await app.inject({ method: 'PUT', url: '/me/email', headers: a.h, payload: { email: 'not an email' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: '/me/email', headers: a.h, payload: { email: ' Ali@Example.com ' } })).statusCode).toBe(200);
    expect(myProfileSchema.parse((await app.inject({ method: 'GET', url: '/me/profile', headers: a.h })).json()).email).toBe('ali@example.com');
    expect(JSON.stringify((await app.inject({ method: 'GET', url: `/players/${a.id}`, headers: b.h })).json())).not.toContain('example.com');
    await app.inject({ method: 'PUT', url: '/me/email', headers: a.h, payload: { email: '' } });
    expect(myProfileSchema.parse((await app.inject({ method: 'GET', url: '/me/profile', headers: a.h })).json()).email).toBeNull();
  });
});

describe('nickname rules', () => {
  const put = (app: ReturnType<typeof boot>['app'], h: Record<string, string>, nickname: string) => app.inject({ method: 'PUT', url: '/me/nickname', headers: h, payload: { nickname } });

  it('applies the admin rules: length, digits, Latin, bad words', async () => {
    const { app, login, store } = boot();
    const a = await login(1);
    expect((await put(app, a.h, 'علی‌آقا')).json()).toEqual({ nickname: 'علی‌آقا' });
    expect(store.nicknames.get(a.id)).toBe('علی‌آقا');
    expect((await put(app, a.h, 'ا')).json()).toEqual({ error: 'too_short' });
    expect((await put(app, a.h, 'علی'.repeat(10))).json()).toEqual({ error: 'too_long' });
    expect((await put(app, a.h, 'علی۱۲')).json()).toEqual({ error: 'has_digits' });
    expect((await put(app, a.h, 'Ali')).json()).toEqual({ error: 'has_latin' });
    expect((await put(app, a.h, 'آدم بد')).json()).toEqual({ error: 'filtered' });
  });

  it('is locked until the player has finished enough games', async () => {
    const { app, login, player } = boot(2);
    const a = await login(1);
    const res = await put(app, a.h, 'علی');
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'locked', unlockGames: 2 });
    expect(myProfileSchema.parse((await app.inject({ method: 'GET', url: '/me/profile', headers: a.h })).json()).nicknameLockedUntilGames).toBe(2);
    await player.recordGame(a.id, { mode: 'duel', outcome: 'loss' });
    await player.recordGame(a.id, { mode: 'duel', outcome: 'loss' });
    expect((await put(app, a.h, 'علی')).statusCode).toBe(200);
  });
});

describe('leaderboard (D108)', () => {
  it('ranks by total XP; city scope only lists the city, friends scope only friends; me is placed even outside the top', async () => {
    const { app, login, store, player } = boot();
    const a = await login(1);
    const b = await login(2);
    const c = await login(3);
    await store.addGame(a.id, 'win', 100);
    await store.addGame(b.id, 'win', 300);
    await store.addGame(c.id, 'win', 200);
    const tehran = (await store.cities())[0]!.id;
    await player.setCity(a.id, tehran);
    await player.setCity(c.id, tehran);
    const get = async (u: typeof a, scope: string) => leaderboardSchema.parse((await app.inject({ method: 'GET', url: `/leaderboard?scope=${scope}`, headers: u.h })).json());

    const all = await get(a, 'all');
    expect(all.entries.map((e) => [e.rank, e.xp, e.isMe])).toEqual([[1, 300, false], [2, 200, false], [3, 100, true]]);
    expect(all.me?.rank).toBe(3);

    const city = await get(a, 'city');
    expect(city.entries.map((e) => e.xp)).toEqual([200, 100]);
    expect(city.entries[0]?.province).toBe('tehran');
    expect(city.me?.rank).toBe(2);

    // No city: the scope is empty.
    expect(await get(b, 'city')).toMatchObject({ entries: [], me: null, hasCity: false });
    // A city that is set is told apart from none (the app asks for a city only in the second case).
    expect(city.hasCity).toBe(true);

    // Friends: only me until someone accepts.
    expect((await get(a, 'friends')).entries.map((e) => e.xp)).toEqual([100]);
    await app.inject({ method: 'POST', url: `/friends/${c.id}/request`, headers: a.h, payload: {} });
    await app.inject({ method: 'POST', url: `/friends/${a.id}/accept`, headers: c.h, payload: {} });
    expect((await get(a, 'friends')).entries.map((e) => e.xp)).toEqual([200, 100]);

    expect((await app.inject({ method: 'GET', url: '/leaderboard?scope=galaxy', headers: a.h })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/leaderboard' })).statusCode).toBe(401);
  });
});

describe('week and month leaderboards', () => {
  it('rank the XP earned inside a rolling window, not the lifetime total', async () => {
    const { app, login, store, clock } = boot();
    const day = 86_400_000;
    const a = await login(1);
    const b = await login(2);
    const start = clock.t;
    clock.t = start - 20 * day; // 20 days ago: inside the month only
    await store.addGame(a.id, 'win', 500);
    clock.t = start - 40 * day; // 40 days ago: neither window
    await store.addGame(b.id, 'win', 900);
    clock.t = start - 2 * day; // 2 days ago: both windows
    await store.addGame(b.id, 'win', 100);
    clock.t = start;
    const get = async (period: string) => leaderboardSchema.parse((await app.inject({ method: 'GET', url: `/leaderboard?scope=all&period=${period}`, headers: a.h })).json());

    expect((await get('all')).entries.map((e) => e.xp)).toEqual([1000, 500]);
    const month = await get('month');
    expect(month.period).toBe('month');
    expect(month.entries.map((e) => e.xp)).toEqual([500, 100]);
    expect(month.me).toMatchObject({ rank: 1, xp: 500 });
    const week = await get('week');
    expect(week.entries.map((e) => e.xp)).toEqual([100]);
    expect(week.me).toMatchObject({ rank: 2, xp: 0 }); // earned nothing this week: placed after the one who did
    expect((await app.inject({ method: 'GET', url: '/leaderboard?period=year', headers: a.h })).statusCode).toBe(400);
  });
});

describe('recent games', () => {
  it('lists the caller\'s last finished games, newest first, only theirs', async () => {
    const { app, login, store, clock } = boot();
    const a = await login(1);
    const b = await login(2);
    clock.t += 1000;
    await store.addGame(a.id, 'win', 30, 'solo');
    clock.t += 1000;
    await store.addGame(a.id, 'loss', 20, 'duel');
    await store.addGame(b.id, 'win', 99, 'duel');
    const res = (await app.inject({ method: 'GET', url: '/me/games', headers: a.h })).json() as { games: { mode: string; outcome: string; xp: number }[] };
    expect(res.games.map((g) => [g.mode, g.outcome, g.xp])).toEqual([['duel', 'loss', 20], ['solo', 'win', 30]]);
    expect((await app.inject({ method: 'GET', url: '/me/games' })).statusCode).toBe(401);
  });
});
