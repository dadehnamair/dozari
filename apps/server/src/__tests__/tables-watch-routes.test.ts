import { describe, expect, it } from 'vitest';
import { mulberry32, publicTablesSchema, tableWatchSchema } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { MatchService } from '../realtime/match-service.js';
import type { PuzzleSource, ServedPuzzle } from '../solo/types.js';
import { TableService } from '../tables/service.js';

const puzzle: ServedPuzzle = {
  id: 'pz1',
  groups: ([0, 1, 2, 3] as const).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`), titleFa: `عنوان${level}`, explanationFa: `توضیح${level}` })),
  items: Object.fromEntries([0, 1, 2, 3].flatMap((l) => [0, 1, 2, 3].map((i) => [`g${l}p${i}`, { nameFa: `کالا${l}${i}`, unitFa: null }]))),
};
const source: PuzzleSource = { pickRandom: async () => puzzle, pricesFor: async () => ({}) };

describe('watching a table over HTTP', () => {
  it('lists a playing table with its score, serves a redacted watch view, takes cheers with a pause between, and hides non-playing tables', async () => {
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
    const login = await auth.guestLogin('0f8fad5b-d9cb-469f-a165-708677289577');
    if (!login.ok) throw new Error('login');
    const headers = { authorization: `Bearer ${login.session.token}` };
    const clock = { ms: 1_000_000 };
    const matches = new MatchService({ puzzles: source, profile: async (id) => ({ nickname: id, avatarKey: 'a', level: 1, coins: 0 }), emit: () => undefined, now: () => clock.ms, newSeed: () => 5, schedule: () => () => undefined });
    const tables = new TableService({
      profileOf: async (id) => ({ nickname: `n-${id}`, avatarKey: 'avatar-01' }),
      startMatch: (a, b) => matches.start(a, b, { friendly: true }),
      inMatch: (id) => matches.inMatch(id),
      scoresOf: (id) => matches.scoresOf(id),
      idleMs: async () => 15 * 60_000,
      now: () => clock.ms,
      rng: mulberry32(2),
    });
    const playingCode = (await tables.createAmbient('botA', { name: 'میز تماشا', icon: 'dice', format: '1v1', rounds: 1, priceRounds: 0, extraBots: [], ttlMs: 60_000 }))!;
    const openCode = (await tables.createAmbient('botC', { name: 'میز باز', icon: 'dice', format: '1v1', rounds: 1, priceRounds: 0, extraBots: [], ttlMs: 60_000 }))!;
    expect(await tables.fillAndStart(playingCode, ['botB'])).toBe(true);
    const app = buildServer({ auth, tables, live: { matches } });

    const list = publicTablesSchema.parse((await app.inject({ method: 'GET', url: '/tables/public', headers })).json());
    const row = list.tables.find((t) => t.code === playingCode)!;
    expect(row).toMatchObject({ status: 'playing', scores: [0, 0] });
    expect(list.tables.find((t) => t.code === openCode)?.status).toBe('open');

    const watch = await app.inject({ method: 'GET', url: `/tables/${playingCode}/watch`, headers });
    expect(watch.statusCode).toBe(200);
    const seen = tableWatchSchema.parse(watch.json());
    expect(seen.watchers).toBe(1);
    expect(seen.view.cards).toHaveLength(16);
    expect(JSON.stringify(watch.json())).not.toContain('عنوان'); // unsolved group titles never reach the stands
    expect((await app.inject({ method: 'GET', url: `/tables/${openCode}/watch`, headers })).statusCode).toBe(404);

    const cheer = (kind: string) => app.inject({ method: 'POST', url: `/tables/${playingCode}/react`, headers, payload: { kind } });
    expect((await cheer('clap')).statusCode).toBe(200);
    expect((await cheer('fire')).statusCode).toBe(429); // too soon after the last one
    expect((await cheer('nonsense')).statusCode).toBe(400);
    clock.ms += 3000;
    expect((await cheer('fire')).statusCode).toBe(200);
    const again = tableWatchSchema.parse((await app.inject({ method: 'GET', url: `/tables/${playingCode}/watch`, headers })).json());
    expect(again.reactions.map((r) => r.kind)).toEqual(['clap', 'fire']);
    clock.ms += 25_000;
    expect(tableWatchSchema.parse((await app.inject({ method: 'GET', url: `/tables/${playingCode}/watch`, headers })).json()).reactions).toEqual([]);
    expect((await app.inject({ method: 'GET', url: `/tables/${playingCode}/watch` })).statusCode).toBe(401);
  });
});
