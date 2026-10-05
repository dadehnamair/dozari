import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@dozari/shared';
import type { AgeTrack } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AgeTrackService } from '../agetrack/service.js';
import type { AgeTrackStore, TrackRecord } from '../agetrack/service.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { MatchService } from '../realtime/match-service.js';
import type { PuzzleSource, ServedPuzzle } from '../solo/types.js';
import { SocialService } from '../social/service.js';
import { createMemorySocialStore } from '../social/store.js';

const puzzle: ServedPuzzle = {
  id: 'pz1',
  groups: ([0, 1, 2, 3] as const).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`), titleFa: `t${level}`, explanationFa: `e${level}` })),
  items: Object.fromEntries([0, 1, 2, 3].flatMap((l) => [0, 1, 2, 3].map((i) => [`g${l}p${i}`, { nameFa: `x${l}${i}`, unitFa: null }]))),
};
const source: PuzzleSource = { pickRandom: async () => puzzle, pricesFor: async () => ({}) };

function tracksOf(map: Record<string, AgeTrack>, enabled = true) {
  const store: AgeTrackStore = {
    get: async (id): Promise<TrackRecord> => ({ track: map[id] ?? 'adult', setAt: new Date() }),
    getMany: async (ids) => new Map(ids.map((i) => [i, map[i] ?? 'adult'] as [string, AgeTrack])),
    save: async () => {},
  };
  return new AgeTrackService(store, async () => enabled);
}

describe('no coin wagers for kid and teen', () => {
  async function run(map: Record<string, AgeTrack>) {
    const opened: string[] = [];
    const ages = tracksOf(map);
    const svc = new MatchService({
      puzzles: source,
      profile: async (id) => ({ nickname: id, avatarKey: 'a', level: 1, coins: 0 }),
      emit: () => {},
      newSeed: () => 5,
      schedule: () => () => {},
      wagerAllowed: (id) => ages.allows(id, 'coinWager'),
      stakes: { open: async (_m, players) => (opened.push(...players), ['free', 'free']), cancel: async () => {}, settle: async () => {} },
    });
    expect(await svc.start('p1', 'p2')).toBe(true);
    return opened;
  }

  it('takes stakes between adults', async () => {
    expect(await run({})).toEqual(['p1', 'p2']);
  });

  it('takes no stake when either player is a kid or a teen', async () => {
    expect(await run({ p1: 'kid', p2: 'kid' })).toEqual([]);
    expect(await run({ p1: 'teen', p2: 'teen' })).toEqual([]);
    expect(await run({ p1: 'adult', p2: 'kid' })).toEqual([]);
  });
});

describe('walls by path and by profile', () => {
  const SECRET = 'a-test-secret-that-is-long-enough';
  async function boot(map: Record<string, AgeTrack>) {
    const byId = new Map<string, UserRecord & { deviceId: string }>();
    const repo: UserRepository = {
      findByDeviceId: async (d) => [...byId.values()].find((u) => u.deviceId === d) ?? null,
      findById: async (id) => byId.get(id) ?? null,
      createGuest: async (deviceId, identity) => {
        const user = { id: `00000000-0000-7000-8000-${String(byId.size + 1).padStart(12, '0')}`, deviceId, ...identity, isBanned: false };
        byId.set(user.id, user);
        return user;
      },
      touch: async () => undefined,
    };
    const auth = new AuthService(repo, createTokenSigner(SECRET, () => 1_700_000_000_000), mulberry32(3));
    const guest = async (n: number) => {
      const s = await auth.guestLogin(`0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}`);
      if (!s.ok) throw new Error('login');
      return { id: s.session.user.id, h: { authorization: `Bearer ${s.session.token}` } };
    };
    const kid = await guest(1);
    const adult = await guest(2);
    map[kid.id] = 'kid';
    const app = buildServer({ auth, ageTracks: tracksOf(map) });
    return { app, kid, adult };
  }

  it('answers 403 age_track to a kid on real-money, ugc, tournament, daily and lookup paths, and passes an adult', async () => {
    const { app, kid, adult } = await boot({});
    for (const url of ['/coin-packages', '/shop-pay/x', '/ugc/feed', '/tournaments', '/daily-puzzle', '/lookup/search?q=a', '/transfers', '/loans/x/repay']) {
      const res = await app.inject({ method: 'GET', url, headers: kid.h });
      expect(res.statusCode, url).toBe(403);
      expect(res.json()).toEqual({ error: 'age_track' });
      expect((await app.inject({ method: 'GET', url, headers: adult.h })).statusCode, url).not.toBe(403);
    }
    // Paths that are open to everybody are untouched.
    expect((await app.inject({ method: 'GET', url: '/me/age-track', headers: kid.h })).statusCode).not.toBe(403);
  });

  it('does not gate when no one is signed in (the route answers 401 itself)', async () => {
    const { app } = await boot({});
    expect((await app.inject({ method: 'GET', url: '/coin-packages' })).statusCode).not.toBe(403);
  });

  it('hides city and province on a kid or teen profile', async () => {
    const seed = ['kid', 'adult'].map((id) => ({ id, nickname: id, avatarKey: 'a', createdAt: 0, coins: 0 }));
    const player = { levelOf: async () => ({ level: { level: 1 }, stats: { games: 0, wins: 0, losses: 0, draws: 0 } }), cityOf: async () => ({ id: 'c', nameFa: 'اصفهان', province: 'اصفهان' }) } as never;
    const social = new SocialService(createMemorySocialStore(seed), Date.now, undefined, player);
    const ages = tracksOf({ kid: 'kid' });
    social.cityVisible = (id) => ages.allows(id, 'publicCity');
    expect((await social.profile('adult', 'kid'))?.cityName).toBeNull();
    expect((await social.profile('kid', 'adult'))?.cityName).toBe('اصفهان');
  });
});

describe('minimal profile, invite code and gifts for kid and teen', () => {
  const seed = ['kid', 'teen', 'adult'].map((id) => ({ id, nickname: id, avatarKey: 'a', createdAt: 1, coins: 50 }));
  const player = {
    levelOf: async () => ({ level: { level: 4 }, stats: { games: 9, wins: 5, losses: 3, draws: 1 } }),
    cityOf: async () => ({ id: 'c', nameFa: 'اصفهان', province: 'isfahan' }),
  } as never;
  const make = () => {
    const social = new SocialService(createMemorySocialStore(seed), Date.now, undefined, player);
    const ages = tracksOf({ kid: 'kid', teen: 'teen' });
    social.profileDepth = (id) => ages.profileDepth(id);
    social.cityVisible = (id) => ages.allows(id, 'publicCity');
    return { social, ages };
  };

  it('a kid shows only name, avatar and level; a teen adds the record but no coins; an adult everything', async () => {
    const { social } = make();
    const kid = await social.profile('adult', 'kid');
    expect(kid).toMatchObject({ limited: true, coins: 0, stats: { games: 0, wins: 0 }, level: 4, cityName: null });
    expect(kid?.badges.medals).toEqual([]);
    const teen = await social.profile('adult', 'teen');
    expect(teen).toMatchObject({ limited: true, coins: 0, stats: { games: 9, wins: 5 }, cityName: null });
    expect(await social.profile('adult', 'adult')).toMatchObject({ limited: false, coins: 50, stats: { games: 9 }, cityName: 'اصفهان' });
    expect(await social.profile('kid', 'kid')).toMatchObject({ isMe: true, limited: false }); // your own profile is yours
  });

  it('a kid has no invite code to share, an adult does', async () => {
    const { InviteService } = await import('../invite/service.js');
    const { createMemoryInviteStore } = await import('../invite/store.js');
    const invite = new InviteService(createMemoryInviteStore(), async () => ({ minLevel: 1, maxUses: 5, inviteeBonus: 10, inviterReward: 20, rewardAfterGames: 1 }), async () => 5, async () => 0, mulberry32(3));
    const { ages } = make();
    invite.canShare = (id) => ages.allows(id, 'inviteShare');
    expect((await invite.mine('kid')).code).toBeNull();
    expect((await invite.mine('adult')).code).not.toBeNull();
  });
});

describe('per-track kill switches (admin)', () => {
  const switches: Record<string, number> = {};
  const make = (map: Record<string, AgeTrack>, enabled = true) => {
    const ages = tracksOf(map, enabled);
    ages.featureSwitch = async (key) => (switches[key] ?? 1) !== 0;
    return ages;
  };

  it('switches a feature off for one track only', async () => {
    const ages = make({ kid: 'kid', teen: 'teen' });
    expect(await ages.featureOff('kid', 'chat')).toBe(false);
    switches['track.kid.chat'] = 0;
    expect(await ages.featureOff('kid', 'chat')).toBe(true);
    expect(await ages.featureOff('teen', 'chat')).toBe(false);
    expect(await ages.featureOff('adult', 'chat')).toBe(false); // adults have no switch
    expect(await ages.featureOff('kid', 'tables')).toBe(false);
    delete switches['track.kid.chat'];
  });

  it('does nothing while age tracks are off, and a failing switch lookup never closes anything', async () => {
    switches['track.kid.chat'] = 0;
    expect(await make({ kid: 'kid' }, false).featureOff('kid', 'chat')).toBe(false);
    const broken = make({ kid: 'kid' });
    broken.featureSwitch = async () => {
      throw new Error('db down');
    };
    expect(await broken.featureOff('kid', 'chat')).toBe(false);
    delete switches['track.kid.chat'];
  });

  it('answers 403 age_track on the paths of a switched-off feature', async () => {
    const SECRET = 'a-test-secret-that-is-long-enough';
    const byId = new Map<string, UserRecord & { deviceId: string }>();
    const repo: UserRepository = {
      findByDeviceId: async (d) => [...byId.values()].find((u) => u.deviceId === d) ?? null,
      findById: async (id) => byId.get(id) ?? null,
      createGuest: async (deviceId, identity) => {
        const user = { id: `00000000-0000-7000-8000-${String(byId.size + 1).padStart(12, '0')}`, deviceId, ...identity, isBanned: false };
        byId.set(user.id, user);
        return user;
      },
      touch: async () => undefined,
    };
    const auth = new AuthService(repo, createTokenSigner(SECRET, () => 1_700_000_000_000), mulberry32(3));
    const login = await auth.guestLogin('0f8fad5b-d9cb-469f-a165-708677289577');
    if (!login.ok) throw new Error('login');
    const kid = { authorization: `Bearer ${login.session.token}` };
    const ages = make({ [login.session.user.id]: 'kid' });
    const app = buildServer({ auth, ageTracks: ages });
    switches['track.kid.wheel'] = 0;
    expect((await app.inject({ method: 'GET', url: '/wheel', headers: kid })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/tables/mine', headers: kid })).statusCode).not.toBe(403);
    delete switches['track.kid.wheel'];
    expect((await app.inject({ method: 'GET', url: '/wheel', headers: kid })).statusCode).not.toBe(403);
  });
});
