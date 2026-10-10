import { afterEach, describe, expect, it } from 'vitest';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { TURN_SECONDS, matchEndedSchema, matchFoundSchema, matchViewSchema, mulberry32 } from '@dozari/shared';
import type { MatchView } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { PuzzleHistory } from '../solo/history.js';
import { MatchService } from '../realtime/match-service.js';
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

/** Fake clock: timers fire only when the test says so. */
function harness() {
  let t = 1_000_000;
  const timers: { at: number; fn: () => void; live: boolean }[] = [];
  const sent: { to: string; event: string; payload: unknown }[] = [];
  const svc = new MatchService({
    puzzles: source,
    profile,
    emit: (to, event, payload) => sent.push({ to, event, payload }),
    now: () => t,
    newSeed: () => 5,
    schedule: (ms, fn) => {
      const timer = { at: t + ms, fn, live: true };
      timers.push(timer);
      return () => (timer.live = false);
    },
  });
  const advance = (ms: number) => {
    t += ms;
    for (const timer of timers.filter((x) => x.live && x.at <= t)) {
      timer.live = false;
      timer.fn();
    }
  };
  const last = (to: string, event: string) => sent.filter((s) => s.to === to && s.event === event).at(-1)?.payload;
  return { svc, sent, advance, last };
}

describe('MatchService', () => {
  it('starts a match, tells both players and never exposes unsolved groups', async () => {
    const { svc, sent, last } = harness();
    expect(await svc.start('A', 'B')).toBe(true);
    expect(svc.activeCount).toBe(1);
    expect(matchFoundSchema.safeParse(last('A', 'match:found')).success).toBe(true);
    const va = matchViewSchema.parse(last('A', 'match:state'));
    const vb = matchViewSchema.parse(last('B', 'match:state'));
    expect([va.you, vb.you]).toEqual([0, 1]);
    expect(va.cards).toHaveLength(16);
    expect(JSON.stringify(sent)).not.toContain('عنوان');
    expect(JSON.stringify(sent)).not.toContain('is_bot');
  });

  it('refuses a second match for a busy player or a lone pair', async () => {
    const { svc } = harness();
    expect(await svc.start('A', 'A')).toBe(false);
    await svc.start('A', 'B');
    expect(await svc.start('A', 'C')).toBe(false);
  });

  it('enforces turns, scores a correct group and keeps the turn', async () => {
    const { svc, last } = harness();
    await svc.start('A', 'B');
    const v = matchViewSchema.parse(last('A', 'match:state'));
    const [first, second] = v.turn === 0 ? (['A', 'B'] as const) : (['B', 'A'] as const);
    expect(svc.submit(second, ids(0))).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
    expect(svc.submit(first, ['g0p0', 'g0p1'])).toEqual({ ok: false, error: 'INVALID_SELECTION' });
    expect(svc.submit(first, ids(0))).toEqual({ ok: true });
    const after = matchViewSchema.parse(last(first, 'match:state')) as MatchView;
    expect(after.solved).toHaveLength(1);
    expect(after.solved[0]).toMatchObject({ level: 0, titleFa: 'عنوان 0', by: after.you });
    expect(after.turn).toBe(after.you);
    expect(after.scores[after.you]).toBeGreaterThan(0);
    expect(svc.submit(first, ids(0))).toEqual({ ok: false, error: 'INVALID_SELECTION' }); // already off the board
    expect(svc.submit('Z', ids(1))).toEqual({ ok: false, error: 'NOT_IN_MATCH' });
  });

  it('passes the turn on a wrong guess and on the turn clock, and forfeits an AFK player', async () => {
    const { svc, advance, last } = harness();
    await svc.start('A', 'B');
    const start = matchViewSchema.parse(last('A', 'match:state'));
    const first = start.turn === 0 ? 'A' : 'B';
    const mix = [ids(0)[0]!, ids(0)[1]!, ids(1)[0]!, ids(1)[1]!];
    svc.submit(first, mix);
    const afterWrong = matchViewSchema.parse(last('A', 'match:state'));
    expect(afterWrong.turn).not.toBe(start.turn);
    expect(afterWrong.mistakes[start.turn]).toBe(1);

    // Nobody moves: turn passes on each timeout, and the first side to time out twice in a row loses.
    advance(TURN_SECONDS * 1000 + 1);
    advance(TURN_SECONDS * 1000 + 1);
    advance(TURN_SECONDS * 1000 + 1);
    const ended = matchEndedSchema.parse(last('A', 'match:ended'));
    expect(ended.result.reason).toBe('forfeit');
    expect(ended.groups).toHaveLength(4);
    expect(svc.activeCount).toBe(0);
    expect(svc.inMatch('A')).toBe(false);
  });

  it('ends the match when a player leaves and lets them queue again', async () => {
    const { svc, last } = harness();
    await svc.start('A', 'B');
    expect(svc.leave('A')).toEqual({ ok: true });
    const ended = matchEndedSchema.parse(last('B', 'match:ended'));
    expect(ended.result).toEqual({ winner: 1, reason: 'abandon' });
    expect(svc.leave('A')).toEqual({ ok: false, error: 'NOT_IN_MATCH' });
    expect(await svc.start('A', 'B')).toBe(true);
  });

  it('re-sends the snapshot on resume and rejects a wrong match id', async () => {
    const { svc, sent } = harness();
    await svc.start('A', 'B');
    const before = sent.length;
    expect(svc.resume('A')).toEqual({ ok: true });
    // who plays whom (a late joiner never saw `match:found`), then the snapshot
    expect(sent.slice(before).map((e) => e.event)).toEqual(['match:found', 'match:state']);
    expect(svc.resume('A', '0190a000-0000-7000-8000-000000000001')).toEqual({ ok: false, error: 'UNKNOWN_MATCH' });
    expect(svc.resume('Z')).toEqual({ ok: false, error: 'NOT_IN_MATCH' });
  });
});

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

describe('live duel over sockets', () => {
  const open: Socket[] = [];
  const apps: ReturnType<typeof buildServer>[] = [];
  afterEach(async () => {
    open.splice(0).forEach((s) => s.close());
    await Promise.all(apps.splice(0).map((a) => a.close()));
  });

  it('pairs two queued players and plays a group to the end', async () => {
    const auth = new AuthService(memoryUsers(), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
    const app = buildServer({ auth, realtime: true, match: { puzzles: source, profile } });
    apps.push(app);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    const dial = async (n: number) => {
      const deviceId = `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}`;
      const { token } = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId } })).json() as { token: string };
      const s = connect(url, { auth: { token }, transports: ['websocket'], reconnection: false });
      open.push(s);
      await new Promise<void>((res) => s.once('connect', () => res()));
      return s;
    };
    const next = <T>(s: Socket, ev: string) => new Promise<T>((res) => s.once(ev, res));

    const a = await dial(1);
    const b = await dial(2);
    const foundA = next(a, 'match:found');
    const foundB = next(b, 'match:found');
    const stateA = next<MatchView>(a, 'match:state');
    expect(await a.emitWithAck('queue:join', { mode: 'duel' })).toEqual({ ok: true });
    expect(await b.emitWithAck('queue:join', { mode: 'duel' })).toEqual({ ok: true });
    expect(matchFoundSchema.parse(await foundA).you).not.toBe(matchFoundSchema.parse(await foundB).you);
    const view = matchViewSchema.parse(await stateA);
    expect(await a.emitWithAck('queue:join', { mode: 'duel' })).toEqual({ ok: false, error: 'ALREADY_IN_MATCH' });

    const mover = view.turn === view.you ? a : b;
    const other = mover === a ? b : a;
    expect(await other.emitWithAck('match:submit', { itemIds: ids(0) })).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
    expect(await mover.emitWithAck('match:submit', { itemIds: ['x'] })).toEqual({ ok: false, error: 'INVALID_PAYLOAD' });
    const seen = next<{ t: string }>(other, 'match:event');
    expect(await mover.emitWithAck('match:submit', { itemIds: ids(0) })).toEqual({ ok: true });
    expect((await seen).t).toBe('guess');

    const ended = next(other, 'match:ended');
    expect(await mover.emitWithAck('match:leave', {})).toEqual({ ok: true });
    expect(matchEndedSchema.parse(await ended).result.reason).toBe('abandon');
    expect(await mover.emitWithAck('match:leave', {})).toEqual({ ok: false, error: 'NOT_IN_MATCH' });
  });
});

describe('no repeated puzzles', () => {
  it('a rematch of the same players is served a different puzzle while others exist', async () => {
    const mk = (n: number) => ({ ...puzzle, id: `pz-${n}` });
    const all = [mk(1), mk(2), mk(3)];
    const history = new PuzzleHistory();
    const svc = new MatchService({
      puzzles: { pickRandom: async (o) => all.find((p) => !(o?.exclude ?? []).includes(p.id)) ?? null, pricesFor: async () => ({}) },
      history,
      profile: async () => ({ nickname: 'n', avatarKey: 'a', level: 1, coins: 0 }),
      emit: () => undefined,
      schedule: () => () => undefined,
    });
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      expect(await svc.start('A', 'B', { friendly: true })).toBe(true);
      seen.push(history.seen(['A']).at(-1)!);
      svc.leave('A');
    }
    expect(new Set(seen).size).toBe(3);
  });
});
