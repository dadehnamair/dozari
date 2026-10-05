import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@dozari/shared';
import type { AgeTrack, LessonCard } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AgeTrackService } from '../agetrack/service.js';
import type { TrackRecord } from '../agetrack/service.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import type { LessonStore } from '../lessons/service.js';

const SECRET = 'a-test-secret-that-is-long-enough';

async function setup(enabled = true) {
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
  const rows = new Map<string, TrackRecord>();
  const ageTracks = new AgeTrackService(
    { get: async (id) => rows.get(id) ?? { track: 'adult', setAt: null }, getMany: async () => new Map<string, AgeTrack>(), save: async (id, track, at) => void rows.set(id, { track, setAt: at }) },
    async () => enabled,
  );
  const cards: LessonCard[] = [
    { productId: 'p-nan', wordFa: 'نان', storyFa: 'نان سنگک داغ', syllablesFa: null },
    { productId: 'p-sib', wordFa: 'سیب', storyFa: '', syllablesFa: 'سیب' },
  ];
  const lessons: LessonStore = {
    approvedFor: async (ids) => cards.filter((c) => ids.includes(c.productId)),
    listKidItems: async () => [],
    save: async () => true,
    setStatus: async () => 'ok',
  };
  const app = buildServer({ auth, ageTracks, lessons });
  const login = await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: '0f8fad5b-d9cb-469f-a165-70867728950e' } });
  const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  return { app, headers };
}

describe('age track routes', () => {
  it('asks once and remembers, and refuses moving older', async () => {
    const { app, headers } = await setup();
    expect((await app.inject({ method: 'GET', url: '/me/age-track', headers })).json()).toMatchObject({ enabled: true, chosen: false, track: 'adult' });
    const put = await app.inject({ method: 'PUT', url: '/me/age-track', headers, payload: { track: 'kid' } });
    expect(put.json()).toMatchObject({ track: 'kid', chosen: true, rules: { wordLesson: true, priceGuess: false } });
    const older = await app.inject({ method: 'PUT', url: '/me/age-track', headers, payload: { track: 'teen' } });
    expect(older.statusCode).toBe(403);
    expect(older.json()).toEqual({ error: 'needs_guardian' });
    expect((await app.inject({ method: 'PUT', url: '/me/age-track', headers, payload: { track: 'baby' } })).statusCode).toBe(400);
  });

  it('answers 503 and no chooser while the feature is off', async () => {
    const { app, headers } = await setup(false);
    expect((await app.inject({ method: 'GET', url: '/me/age-track', headers })).json()).toMatchObject({ enabled: false, chosen: true });
    expect((await app.inject({ method: 'PUT', url: '/me/age-track', headers, payload: { track: 'kid' } })).statusCode).toBe(503);
  });

  it('needs a signed-in player', async () => {
    const { app } = await setup();
    expect((await app.inject({ method: 'GET', url: '/me/age-track' })).statusCode).toBe(401);
  });
});

describe('POST /lessons', () => {
  it('returns the approved cards for the asked items', async () => {
    const { app, headers } = await setup();
    const res = await app.inject({ method: 'POST', url: '/lessons', headers, payload: { productIds: ['p-nan', 'p-other'] } });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { lessons: LessonCard[] }).lessons.map((l) => l.wordFa)).toEqual(['نان']);
  });

  it('rejects an empty or oversized list and anonymous callers', async () => {
    const { app, headers } = await setup();
    expect((await app.inject({ method: 'POST', url: '/lessons', headers, payload: { productIds: [] } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/lessons', headers, payload: { productIds: Array.from({ length: 17 }, (_, i) => `p${i}`) } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/lessons', payload: { productIds: ['p-nan'] } })).statusCode).toBe(401);
  });
});
