import { describe, expect, it } from 'vitest';
import { mulberry32, myBadgesSchema, playerProfileSchema } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { BadgeService } from '../badges/service.js';
import type { PlayerFacts } from '../badges/service.js';
import { createMemoryBadgeStore } from '../badges/store.js';
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

function boot(modRules = { maxMuteMinutes: 60, perDay: 3 }) {
  const clock = { ms: Date.UTC(2026, 9, 2, 12) };
  const seed: { id: string; nickname: string; avatarKey: string; createdAt: number; coins: number }[] = [];
  const store = createMemoryBadgeStore();
  const facts = new Map<string, PlayerFacts>();
  const told: [string, string][] = [];
  const socialStore = createMemorySocialStore(seed);
  const badges = new BadgeService(
    store,
    async (id) => facts.get(id) ?? { games: 0, wins: 0, level: 1 },
    async () => ({ minGames: 10, proGames: 30, proWinPercent: 60 }),
    async () => modRules,
    async (id) => (await socialStore.publicRow(id)) !== null,
    () => clock.ms,
    (id, text) => told.push([id, text]),
  );
  const social = new SocialService(socialStore, () => clock.ms, undefined, undefined, badges);
  const auth = new AuthService(memoryUsers((u) => seed.push({ id: u.id, nickname: u.nickname, avatarKey: u.avatarKey, createdAt: 1, coins: 0 })), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
  const app = buildServer({ auth, social, badges });
  const login = async (n: number) => {
    const r = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}` } })).json() as { token: string; user: { id: string } };
    return { h: { authorization: `Bearer ${r.token}` }, id: r.user.id };
  };
  const mine = async (u: { h: Record<string, string> }) => myBadgesSchema.parse((await app.inject({ method: 'GET', url: '/me/badges', headers: u.h })).json());
  const makeAgent = async (u: { id: string }) => {
    const agent = (await store.catalog()).find((b) => b.perk === 'moderator')!;
    await badges.grant(u.id, agent.id, 'admin');
  };
  return { app, login, store, badges, facts, clock, told, mine, makeAgent };
}

describe('automatic badges and medals', () => {
  it('awards a badge once its rule is met, shows progress while locked, and tells the player', async () => {
    const { login, mine, badges, facts, told } = boot();
    const a = await login(1);
    const first = await mine(a);
    expect(first.earned).toEqual([]);
    expect(first.locked.find((b) => b.titleFa === 'نشان تماس')).toMatchObject({ metric: 'level', min: 10, have: 1 });
    expect(first.locked.some((b) => b.titleFa === 'آجان دوزاری')).toBe(false); // admin-only badges are not listed as a goal
    facts.set(a.id, { games: 1, wins: 0, level: 1 });
    expect((await badges.evaluate(a.id)).map((b) => b.titleFa)).toEqual(['اولین قدم']);
    expect(told).toEqual([[a.id, expect.stringContaining('اولین قدم')]]);
    expect(await badges.evaluate(a.id)).toEqual([]); // once
    facts.set(a.id, { games: 60, wins: 25, level: 10 });
    expect((await badges.evaluate(a.id)).map((b) => b.titleFa).sort()).toEqual(['برنده', 'کهنه‌کار', 'نشان تماس'].sort());
    const now = await mine(a);
    expect(now.perks).toEqual({ shareContact: true, moderator: false });
    expect(now.skill).toBe('beginner'); // 60 games, 41.7% wins
  });

  it('shows one earned badge next to the name and medals on the public profile; refuses a badge not owned', async () => {
    const { app, login, badges, facts, mine } = boot();
    const a = await login(1);
    const b = await login(2);
    facts.set(a.id, { games: 60, wins: 40, level: 10 });
    await badges.evaluate(a.id);
    const share = (await mine(a)).earned.find((x) => x.perk === 'share_contact')!;
    const agent = (await badges.me(b.id)).locked[0]!;
    expect((await app.inject({ method: 'PUT', url: '/me/badge', headers: b.h, payload: { badgeId: agent.id } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PUT', url: '/me/badge', headers: a.h, payload: { badgeId: share.id } })).statusCode).toBe(200);
    const pub = playerProfileSchema.parse((await app.inject({ method: 'GET', url: `/players/${a.id}`, headers: b.h })).json());
    expect(pub.badges.badge?.titleFa).toBe('نشان تماس');
    expect(pub.badges.medals.map((m) => m.titleFa).sort()).toEqual(['اولین قدم', 'برنده', 'کهنه‌کار'].sort());
    expect(pub.badges.skill).toBe('pro'); // 60 games, 66.7%
    expect(JSON.stringify(pub)).not.toContain('warning');
    await app.inject({ method: 'PUT', url: '/me/badge', headers: a.h, payload: { badgeId: null } });
    expect(playerProfileSchema.parse((await app.inject({ method: 'GET', url: `/players/${a.id}`, headers: b.h })).json()).badges.badge).toBeNull();
  });

  it('revoking an equipped badge unequips it and removes its perk', async () => {
    const { login, badges, facts, mine, app } = boot();
    const a = await login(1);
    facts.set(a.id, { games: 0, wins: 0, level: 10 });
    await badges.evaluate(a.id);
    const share = (await mine(a)).earned[0]!;
    await app.inject({ method: 'PUT', url: '/me/badge', headers: a.h, payload: { badgeId: share.id } });
    expect(await badges.revoke(a.id, share.id)).toBe(true);
    const after = await mine(a);
    expect(after.equippedId).toBeNull();
    expect(after.perks.shareContact).toBe(false);
    expect(await badges.revoke(a.id, share.id)).toBe(false);
  });
});

describe('«آجان دوزاری»: warn and mute', () => {
  it('only a moderator may act; limited to others, not other agents, bounded duration and a daily cap', async () => {
    const { app, login, makeAgent, clock, told, mine } = boot({ maxMuteMinutes: 60, perDay: 3 });
    const agent = await login(1);
    const other = await login(2);
    const agent2 = await login(3);
    const post = (u: { h: Record<string, string> }, url: string, payload: Record<string, unknown>) => app.inject({ method: 'POST', url, headers: u.h, payload });
    expect((await post(other, '/mod/warn', { userId: agent.id, text: 'لطفاً مؤدب باش' })).json()).toEqual({ error: 'NOT_MODERATOR' });
    await makeAgent(agent);
    await makeAgent(agent2);
    expect((await post(agent, '/mod/warn', { userId: agent.id, text: 'لطفاً مؤدب باش' })).json()).toEqual({ error: 'SELF' });
    expect((await post(agent, '/mod/warn', { userId: agent2.id, text: 'لطفاً مؤدب باش' })).json()).toEqual({ error: 'PROTECTED' });
    expect((await post(agent, '/mod/warn', { userId: '00000000-0000-7000-8000-0000000000ff', text: 'لطفاً مؤدب باش' })).json()).toEqual({ error: 'NOT_FOUND' });
    expect((await post(agent, '/mod/warn', { userId: other.id, text: 'ا' })).json()).toEqual({ error: 'TEXT' });
    expect((await post(agent, '/mod/mute', { userId: other.id, minutes: 61, reason: 'فحش' })).json()).toEqual({ error: 'DURATION' });
    expect((await post(agent, '/mod/warn', { userId: other.id, text: 'لطفاً مؤدب باش' })).statusCode).toBe(200);
    expect((await post(agent, '/mod/mute', { userId: other.id, minutes: 30, reason: 'فحش' })).statusCode).toBe(200);
    const m = await mine(other);
    expect(m.notices).toMatchObject([{ kind: 'warning', by: 'agent', read: false }]);
    expect(m.muted).toMatchObject({ reason: 'فحش', until: clock.ms + 30 * 60_000 });
    expect(told.map((t) => t[1]).join('|')).toContain('اخطار');
    expect((await post(agent, '/mod/warn', { userId: other.id, text: 'باز هم' })).statusCode).toBe(200);
    expect((await post(agent, '/mod/warn', { userId: other.id, text: 'باز هم' })).json()).toEqual({ error: 'LIMIT' }); // 3 per day
    clock.ms += DAY;
    expect((await post(agent, '/mod/warn', { userId: other.id, text: 'فردا' })).statusCode).toBe(200);
    expect((await mine(other)).muted).toBeNull(); // the mute ended
    await app.inject({ method: 'POST', url: '/me/notices/read', headers: other.h });
    expect((await mine(other)).notices.every((n) => n.read)).toBe(true);
  });
});
