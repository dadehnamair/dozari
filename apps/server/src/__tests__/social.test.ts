import { describe, expect, it } from 'vitest';
import { friendsSchema, mulberry32, myProfileSchema, playerProfileSchema } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { SocialService } from '../social/service.js';
import { createMemorySocialStore } from '../social/store.js';

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

function boot() {
  const seed: { id: string; nickname: string; avatarKey: string; createdAt: number; coins: number }[] = [];
  const store = createMemorySocialStore(seed);
  const asked: [string, string][] = [];
  const social = new SocialService(store, Date.now, (target, nick) => asked.push([target, nick]));
  const auth = new AuthService(memoryUsers((u) => seed.push({ id: u.id, nickname: u.nickname, avatarKey: u.avatarKey, createdAt: 1_700_000_000_000, coins: 25 })), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
  const app = buildServer({ auth, social });
  const login = async (n: number) => {
    const r = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}` } })).json() as { token: string; user: { id: string } };
    return { h: { authorization: `Bearer ${r.token}` }, id: r.user.id };
  };
  return { app, login, store, asked };
}

describe('player profile (D67)', () => {
  it('shows the public summary without any bot flag or gender', async () => {
    const { app, login } = boot();
    const a = await login(1);
    const b = await login(2);
    const res = await app.inject({ method: 'GET', url: `/players/${b.id}`, headers: a.h });
    const p = playerProfileSchema.parse(res.json());
    expect(p).toMatchObject({ id: b.id, coins: 25, level: 1, relation: 'none', isMe: false, memberSince: 1_700_000_000_000 });
    expect(Object.keys(res.json())).not.toContain('gender');
    expect(JSON.stringify(res.json()).toLowerCase()).not.toContain('bot');
    expect(playerProfileSchema.parse((await app.inject({ method: 'GET', url: `/players/${a.id}`, headers: a.h })).json()).isMe).toBe(true);
    expect((await app.inject({ method: 'GET', url: `/players/${b.id}` })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/players/nope', headers: a.h })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/players/00000000-0000-7000-8000-0000000000ff', headers: a.h })).statusCode).toBe(404);
  });
});

describe('friend requests', () => {
  it('request -> shows as sent / received -> accept -> friends -> unfriend', async () => {
    const { app, login, asked } = boot();
    const a = await login(1);
    const b = await login(2);
    expect((await app.inject({ method: 'POST', url: `/friends/${b.id}/request`, headers: a.h })).json()).toEqual({ status: 'sent' });
    expect(asked).toEqual([[b.id, expect.any(String)]]);
    expect((await app.inject({ method: 'POST', url: `/friends/${b.id}/request`, headers: a.h })).statusCode).toBe(409);
    expect(playerProfileSchema.parse((await app.inject({ method: 'GET', url: `/players/${b.id}`, headers: a.h })).json()).relation).toBe('sent');
    expect(playerProfileSchema.parse((await app.inject({ method: 'GET', url: `/players/${a.id}`, headers: b.h })).json()).relation).toBe('received');
    expect(friendsSchema.parse((await app.inject({ method: 'GET', url: '/friends', headers: b.h })).json()).incoming.map((x) => x.id)).toEqual([a.id]);
    expect((await app.inject({ method: 'POST', url: `/friends/${b.id}/accept`, headers: a.h })).statusCode).toBe(404); // only the receiver may accept
    expect((await app.inject({ method: 'POST', url: `/friends/${a.id}/accept`, headers: b.h })).json()).toEqual({ status: 'friends' });
    const list = friendsSchema.parse((await app.inject({ method: 'GET', url: '/friends', headers: a.h })).json());
    expect(list.friends.map((x) => x.id)).toEqual([b.id]);
    expect(list.incoming).toEqual([]);
    expect((await app.inject({ method: 'DELETE', url: `/friends/${a.id}`, headers: b.h })).json()).toEqual({ status: 'none' });
    expect((await app.inject({ method: 'DELETE', url: `/friends/${a.id}`, headers: b.h })).statusCode).toBe(404);
  });

  it('asking back after being asked makes you friends; self and unknown are refused; decline removes', async () => {
    const { app, login } = boot();
    const a = await login(1);
    const b = await login(2);
    expect((await app.inject({ method: 'POST', url: `/friends/${a.id}/request`, headers: a.h })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/friends/00000000-0000-7000-8000-0000000000ff/request', headers: a.h })).statusCode).toBe(404);
    await app.inject({ method: 'POST', url: `/friends/${b.id}/request`, headers: a.h });
    expect((await app.inject({ method: 'POST', url: `/friends/${a.id}/request`, headers: b.h })).json()).toEqual({ status: 'friends' });
    await app.inject({ method: 'DELETE', url: `/friends/${b.id}`, headers: a.h });
    await app.inject({ method: 'POST', url: `/friends/${b.id}/request`, headers: a.h });
    expect((await app.inject({ method: 'DELETE', url: `/friends/${a.id}`, headers: b.h })).statusCode).toBe(200); // decline
    expect(friendsSchema.parse((await app.inject({ method: 'GET', url: '/friends', headers: b.h })).json()).incoming).toEqual([]);
  });
});

describe('gender setting (D68)', () => {
  it('is empty at first, can be set, changed and cleared, and only from the list', async () => {
    const { app, login } = boot();
    const a = await login(1);
    expect(myProfileSchema.parse((await app.inject({ method: 'GET', url: '/me/profile', headers: a.h })).json()).gender).toBeNull();
    for (const g of ['female', 'male', null]) {
      expect((await app.inject({ method: 'PUT', url: '/me/gender', headers: a.h, payload: { gender: g } })).statusCode).toBe(200);
      expect(myProfileSchema.parse((await app.inject({ method: 'GET', url: '/me/profile', headers: a.h })).json()).gender).toBe(g);
    }
    expect((await app.inject({ method: 'PUT', url: '/me/gender', headers: a.h, payload: { gender: 'robot' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: '/me/gender', payload: { gender: 'male' } })).statusCode).toBe(401);
  });
});
