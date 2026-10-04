import { afterEach, describe, expect, it } from 'vitest';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { matchFoundSchema, matchViewSchema, mulberry32 } from '@dozari/shared';
import type { MatchView } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import type { PlayerProfile } from '../realtime/match-service.js';
import type { PuzzleSource, ServedPuzzle } from '../solo/types.js';

const puzzle: ServedPuzzle = {
  id: 'pz1',
  groups: ([0, 1, 2, 3] as const).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`), titleFa: `عنوان ${level}`, explanationFa: `توضیح ${level}` })),
  items: Object.fromEntries([0, 1, 2, 3].flatMap((l) => [0, 1, 2, 3].map((i) => [`g${l}p${i}`, { nameFa: `کالا ${l}-${i}`, unitFa: null }]))),
};
const ids = (level: number) => [0, 1, 2, 3].map((i) => `g${level}p${i}`);
const source: PuzzleSource = { pickRandom: async () => puzzle, pricesFor: async () => ({}) };
const profile = async (userId: string): Promise<PlayerProfile> => ({ nickname: `n-${userId}`, avatarKey: 'a', level: 1, coins: 0 });

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


describe('live 2v2 over sockets', () => {
  const open: Socket[] = [];
  const apps: ReturnType<typeof buildServer>[] = [];
  afterEach(async () => {
    open.splice(0).forEach((s) => s.close());
    await Promise.all(apps.splice(0).map((a) => a.close()));
  });

  it('fills a team match from four queued players; proposals reach only the captain', async () => {
    const auth = new AuthService(memoryUsers(), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
    const app = buildServer({ auth, realtime: true, match: { puzzles: source, profile } });
    apps.push(app);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    const views = new Map<Socket, MatchView>();
    const events = new Map<Socket, { t: string }[]>();
    const dial = async (n: number) => {
      const deviceId = `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}`;
      const { token } = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId } })).json() as { token: string };
      const s = connect(url, { auth: { token }, transports: ['websocket'], reconnection: false });
      open.push(s);
      events.set(s, []);
      s.on('match:state', (v: unknown) => views.set(s, matchViewSchema.parse(v)));
      s.on('match:event', (e: { t: string }) => events.get(s)?.push(e));
      await new Promise<void>((res) => s.once('connect', () => res()));
      return s;
    };
    const until = async (ok: () => boolean) => {
      for (let i = 0; i < 100 && !ok(); i++) await new Promise((r) => setTimeout(r, 20));
      expect(ok()).toBe(true);
    };

    const socks = [await dial(1), await dial(2), await dial(3), await dial(4)];
    const found = socks.map((s) => new Promise<unknown>((res) => s.once('match:found', res)));
    for (const s of socks) expect(await s.emitWithAck('queue:join', { mode: 'team' })).toEqual({ ok: true });
    const foundViews = (await Promise.all(found)).map((f) => matchFoundSchema.parse(f));
    expect(foundViews.every((f) => f.players.length === 4)).toBe(true);
    expect(foundViews.filter((f) => f.you === 0)).toHaveLength(2);
    await until(() => views.size === 4);

    const side = [...views.values()][0]!.turn;
    const mine = socks.filter((s) => views.get(s)!.you === side);
    const rivals = socks.filter((s) => views.get(s)!.you !== side);
    const captain = mine.find((s) => views.get(s)!.captain![side] === views.get(s)!.youId)!;
    const mate = mine.find((s) => s !== captain)!;

    expect(await mate.emitWithAck('match:submit', { itemIds: ids(0) })).toEqual({ ok: false, error: 'NOT_CAPTAIN' });
    expect(await mate.emitWithAck('match:propose', { itemIds: ['g0p0', 'g0p1'] })).toEqual({ ok: true });
    await until(() => views.get(captain)!.proposal?.itemIds.length === 2);
    expect(views.get(mate)!.proposal?.itemIds).toHaveLength(2);
    for (const r of rivals) expect(views.get(r)!.proposal ?? null).toBeNull();
    for (const s of socks) expect(events.get(s)!.some((e) => JSON.stringify(e).includes('proposal'))).toBe(false);
    expect(await rivals[0]!.emitWithAck('match:propose', { itemIds: [] })).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });

    expect(await captain.emitWithAck('match:submit', { itemIds: ids(0) })).toEqual({ ok: true });
    await until(() => views.get(captain)!.solved.length === 1);
    expect(views.get(captain)!.scores[side]).toBeGreaterThan(0);
  });
});
