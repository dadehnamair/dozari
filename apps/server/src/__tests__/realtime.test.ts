import { afterEach, describe, expect, it } from 'vitest';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { mulberry32 } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { DuelQueue } from '../realtime/queue.js';
import { SocketStats } from '../realtime/stats.js';

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

describe('DuelQueue', () => {
  it('is FIFO, one entry per player, pairs the longest waiters', () => {
    const q = new DuelQueue();
    expect(q.join('a', 0)).toBe(true);
    expect(q.join('a', 5)).toBe(false);
    q.join('b', 10);
    q.join('c', 20);
    expect(q.position('c')).toBe(3);
    expect(q.longestWaitMs(30)).toBe(30);
    expect(q.takePair()).toEqual(['a', 'b']);
    expect(q.length).toBe(1);
    expect(q.takePair()).toBeNull();
    expect(q.leave('c')).toBe(true);
    expect(q.leave('c')).toBe(false);
  });
});

describe('SocketStats', () => {
  it('tracks connections, the peak and the queue probes', () => {
    let t = 1_000;
    const stats = new SocketStats({ queueLength: () => 2, activeMatches: () => 1, longestWaitMs: () => 4_500 }, () => t);
    stats.connected();
    stats.connected();
    stats.disconnected();
    stats.rejectedHandshake();
    t += 125_000;
    expect(stats.snapshot()).toMatchObject({
      connections: 1,
      peakConnections: 2,
      totalConnections: 2,
      rejectedHandshakes: 1,
      queueLength: 2,
      activeMatches: 1,
      longestWaitSec: 4,
      uptimeSec: 125,
    });
  });
});

describe('socket gateway', () => {
  const open: Socket[] = [];
  const apps: ReturnType<typeof buildServer>[] = [];
  afterEach(async () => {
    open.splice(0).forEach((s) => s.close());
    await Promise.all(apps.splice(0).map((a) => a.close()));
  });

  async function boot() {
    const auth = new AuthService(memoryUsers(), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
    const admin = { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' as const }, token: 'secret-admin-token' };
    const app = buildServer({ auth, realtime: true, admin });
    apps.push(app);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    const login = async (n: number) => {
      const deviceId = `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}`;
      return ((await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId } })).json() as { token: string }).token;
    };
    const dial = (token: string | undefined) => {
      const s = connect(url, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false });
      open.push(s);
      return s;
    };
    const stats = async () => (await app.inject({ method: 'GET', url: '/admin/socket', headers: { 'x-admin-token': admin.token } })).json() as Record<string, number>;
    return { app, login, dial, stats };
  }

  const once = <T>(s: Socket, ev: string) => new Promise<T>((res) => s.once(ev, res));

  it('refuses a missing or forged token', async () => {
    const { dial, stats } = await boot();
    for (const token of [undefined, 'garbage']) {
      const err = await new Promise<Error>((res) => dial(token).once('connect_error', res));
      expect(err.message).toBe('UNAUTHORIZED');
    }
    expect((await stats()).rejectedHandshakes).toBe(2);
  });

  it('joins and leaves the queue with acks and shows up in the admin stats', async () => {
    const { login, dial, stats } = await boot();
    const s = dial(await login(1));
    await once(s, 'connect');
    expect((await stats()).connections).toBe(1);

    const bad = await s.emitWithAck('queue:join', { mode: 'squad' });
    expect(bad).toEqual({ ok: false, error: 'INVALID_PAYLOAD' });
    expect(await s.emitWithAck('queue:join', { mode: 'duel' })).toEqual({ ok: true });
    expect(await s.emitWithAck('queue:join', { mode: 'duel' })).toEqual({ ok: false, error: 'ALREADY_QUEUED' });
    expect((await stats()).queueLength).toBe(1);

    expect(await s.emitWithAck('queue:leave', {})).toEqual({ ok: true });
    expect(await s.emitWithAck('queue:leave', {})).toEqual({ ok: false, error: 'NOT_QUEUED' });
    expect((await stats()).queueLength).toBe(0);
  });

  it('drops a player from the queue when the connection closes', async () => {
    const { login, dial, stats } = await boot();
    const s = dial(await login(2));
    await once(s, 'connect');
    await s.emitWithAck('queue:join', { mode: 'duel' });
    s.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(await stats()).toMatchObject({ connections: 0, queueLength: 0, peakConnections: 1 });
  });
});
