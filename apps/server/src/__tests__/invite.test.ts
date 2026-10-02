import { describe, expect, it } from 'vitest';
import { mulberry32, myInviteSchema } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { InviteService } from '../invite/service.js';
import type { InviteRules } from '../invite/service.js';
import { createMemoryInviteStore } from '../invite/store.js';
import { DEFAULT_RULES, PlayerService } from '../player/service.js';
import { createMemoryPlayerStore } from '../player/store.js';
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

const rules: InviteRules = { minLevel: 2, maxUses: 2, inviteeBonus: 50, inviterReward: 100, rewardAfterGames: 3 };

function boot() {
  const seed: { id: string; nickname: string; avatarKey: string; createdAt: number; coins: number }[] = [];
  const store = createMemoryInviteStore();
  const players = createMemoryPlayerStore();
  const player = new PlayerService(players, async () => ({ ...DEFAULT_RULES, nicknameUnlockGames: 0, renameNeedsInvite: true }), undefined, (id) => store.isActivated(id));
  const invite = new InviteService(store, async () => rules, async (id) => (await player.levelOf(id)).level.level, async (id) => (await player.levelOf(id)).stats.games, mulberry32(9));
  player.afterGame = (id) => invite.settle(id);
  const social = new SocialService(createMemorySocialStore(seed), Date.now, undefined, player);
  const auth = new AuthService(memoryUsers((u) => seed.push({ id: u.id, nickname: u.nickname, avatarKey: u.avatarKey, createdAt: 1, coins: 0 })), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
  const app = buildServer({ auth, social, invite });
  const login = async (n: number) => {
    const r = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}` } })).json() as { token: string; user: { id: string } };
    return { h: { authorization: `Bearer ${r.token}` }, id: r.user.id };
  };
  const levelUp = async (id: string) => {
    for (let i = 0; i < 2; i++) await player.recordGame(id, { mode: 'duel', outcome: 'win' }); // 50 XP = level 2
  };
  return { app, login, store, player, levelUp };
}
const mine = async (app: ReturnType<typeof boot>['app'], h: Record<string, string>) => myInviteSchema.parse((await app.inject({ method: 'GET', url: '/me/invite', headers: h })).json());
const redeem = (app: ReturnType<typeof boot>['app'], h: Record<string, string>, code: string) => app.inject({ method: 'POST', url: '/invite/redeem', headers: h, payload: { code } });

describe('invite ("gold") codes', () => {
  it('gives a personal code only from the minimum level, and the same code every time', async () => {
    const { app, login, levelUp } = boot();
    const a = await login(1);
    const before = await mine(app, a.h);
    expect(before).toMatchObject({ code: null, minLevel: 2, level: 1, activated: false });
    await levelUp(a.id);
    const first = await mine(app, a.h);
    expect(first.code).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);
    expect((await mine(app, a.h)).code).toBe(first.code);
    expect(first).toMatchObject({ uses: 0, maxUses: 2, rewarded: 0, pending: 0, rules: { inviteeBonus: 50, inviterReward: 100, rewardAfterGames: 3 } });
  });

  it('redeeming activates the account and pays the bonus; the inviter is paid only after enough games, once', async () => {
    const { app, login, levelUp, store, player } = boot();
    const a = await login(1);
    const b = await login(2);
    await levelUp(a.id);
    const code = (await mine(app, a.h)).code!;
    const res = await redeem(app, b.h, ` ${code.toLowerCase()} `);
    expect(res.json()).toEqual({ bonus: 50, balance: 50 });
    expect((await mine(app, b.h)).activated).toBe(true);
    expect(await mine(app, a.h)).toMatchObject({ uses: 1, pending: 1, rewarded: 0 });
    await player.recordGame(b.id, { mode: 'solo', outcome: 'win' });
    await player.recordGame(b.id, { mode: 'solo', outcome: 'loss' });
    expect(store.coins.get(a.id) ?? 0).toBe(0); // 2 games: not yet
    await player.recordGame(b.id, { mode: 'solo', outcome: 'loss' });
    expect(store.coins.get(a.id)).toBe(100);
    await player.recordGame(b.id, { mode: 'solo', outcome: 'win' });
    expect(store.coins.get(a.id)).toBe(100); // paid once
    expect(await mine(app, a.h)).toMatchObject({ pending: 0, rewarded: 1 });
  });

  it('refuses own code, a second redemption, unknown, exhausted and switched-off codes', async () => {
    const { app, login, levelUp, store } = boot();
    const a = await login(1);
    const [b, c, d] = [await login(2), await login(3), await login(4)];
    await levelUp(a.id);
    const code = (await mine(app, a.h)).code!;
    expect((await redeem(app, a.h, code)).json()).toEqual({ error: 'own_code' });
    expect((await redeem(app, b.h, 'ZZZZZZ')).statusCode).toBe(404);
    expect((await redeem(app, b.h, 'x')).statusCode).toBe(404);
    expect((await redeem(app, b.h, code)).statusCode).toBe(200);
    expect((await redeem(app, b.h, code)).json()).toEqual({ error: 'already_redeemed' });
    expect((await redeem(app, c.h, code)).statusCode).toBe(200);
    expect((await redeem(app, d.h, code)).json()).toEqual({ error: 'exhausted' }); // max 2 uses
    store.banned.add(a.id);
    const e = await login(5);
    expect((await redeem(app, e.h, code)).json()).toEqual({ error: 'inactive' });
  });

  it('rate-limits guessing', async () => {
    const { app, login } = boot();
    const a = await login(1);
    for (let i = 0; i < 8; i++) await redeem(app, a.h, 'ZZZZZZ');
    const res = await redeem(app, a.h, 'ZZZZZZ');
    expect(res.statusCode).toBe(429);
  });

  it('renaming needs an activated account', async () => {
    const { app, login, levelUp } = boot();
    const a = await login(1);
    const b = await login(2);
    await levelUp(a.id);
    const put = (h: Record<string, string>) => app.inject({ method: 'PUT', url: '/me/nickname', headers: h, payload: { nickname: 'علی' } });
    expect((await put(b.h)).json()).toEqual({ error: 'needs_invite', unlockGames: undefined });
    await redeem(app, b.h, (await mine(app, a.h)).code!);
    expect((await put(b.h)).statusCode).toBe(200);
  });
});
