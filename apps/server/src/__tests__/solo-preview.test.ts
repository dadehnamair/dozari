import { describe, expect, it } from 'vitest';
import type { AgeTrack } from '@dozari/shared';
import { mulberry32 } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { SoloService } from '../solo/service.js';
import type { PuzzleSource, ServedPuzzle } from '../solo/types.js';

const puzzle: ServedPuzzle = {
  id: 'pz1',
  groups: ([0, 1, 2, 3] as const).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`), titleFa: `t${level}`, explanationFa: `e${level}` })),
  items: Object.fromEntries([0, 1, 2, 3].flatMap((l) => [0, 1, 2, 3].map((i) => [`g${l}p${i}`, { nameFa: `x${l}${i}`, unitFa: null }]))),
};

describe('guardian preview of the kid and teen space', () => {
  async function boot() {
    const asked: (readonly AgeTrack[] | undefined)[] = [];
    const source: PuzzleSource = { pickRandom: async (opts) => (asked.push(opts?.tracks), puzzle), pricesFor: async () => ({}) };
    const finished: string[] = [];
    const solo = new SoloService(source, { onFinished: (id) => void finished.push(id) });
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
    const auth = new AuthService(repo, createTokenSigner('a-test-secret-that-is-long-enough', () => 1_700_000_000_000), mulberry32(3));
    const login = async (n: number) => {
      const s = await auth.guestLogin(`0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}`);
      if (!s.ok) throw new Error('login');
      return { id: s.session.user.id, h: { authorization: `Bearer ${s.session.token}` } };
    };
    const guardian = await login(1);
    const stranger = await login(2);
    const app = buildServer({ auth, solo, canPreview: async (id) => id === guardian.id });
    return { app, guardian, stranger, asked, finished };
  }

  it('serves a kid-pool puzzle to a guardian and records nothing', async () => {
    const { app, guardian, asked, finished } = await boot();
    const res = await app.inject({ method: 'POST', url: '/solo/start', headers: guardian.h, payload: { preview: 'kid' } });
    expect(res.statusCode).toBe(200);
    expect(asked.at(-1)).toEqual(['kid']);
    const view = res.json() as { id: string };
    // Finish the game: the anonymous session never reports to the level/stat hook.
    for (const level of [0, 1, 2, 3]) await app.inject({ method: 'POST', url: `/solo/${view.id}/guess`, payload: { productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`) } });
    expect(finished).toEqual([]);
  });

  it('refuses anyone who is not a guardian, and an unknown track, and works as before without a preview', async () => {
    const { app, stranger, guardian, asked } = await boot();
    expect((await app.inject({ method: 'POST', url: '/solo/start', headers: stranger.h, payload: { preview: 'kid' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/solo/start', payload: { preview: 'teen' } })).statusCode).toBe(403);
    const normal = await app.inject({ method: 'POST', url: '/solo/start', headers: guardian.h });
    expect(normal.statusCode).toBe(200);
    expect(asked.at(-1)).toEqual(['adult']); // no preview → the player's own pool (adult here)
    expect((await app.inject({ method: 'POST', url: '/solo/start', headers: guardian.h, payload: { preview: 'adult' } })).statusCode).toBe(200); // not a preview request: plain start
  });
});
