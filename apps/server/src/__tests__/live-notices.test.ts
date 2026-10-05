import { afterEach, describe, expect, it } from 'vitest';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { liveNoticeSchema, mulberry32 } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { createLiveNotices } from '../realtime/notices.js';

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

describe('live notices over the socket', () => {
  const open: Socket[] = [];
  const apps: ReturnType<typeof buildServer>[] = [];
  afterEach(async () => {
    open.splice(0).forEach((s) => s.close());
    await Promise.all(apps.splice(0).map((a) => a.close()));
  });

  it('pushes a notice only to the addressed player', async () => {
    const auth = new AuthService(memoryUsers(), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
    const notices = createLiveNotices();
    const app = buildServer({ auth, realtime: true, notices });
    apps.push(app);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    const dial = async (n: number) => {
      const deviceId = `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}`;
      const r = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId } })).json() as { token: string; user: { id: string } };
      const s = connect(url, { auth: { token: r.token }, transports: ['websocket'], reconnection: false });
      open.push(s);
      await new Promise<void>((res) => s.once('connect', () => res()));
      return { s, id: r.user.id };
    };
    const a = await dial(1);
    const b = await dial(2);
    const got: { who: string; n: unknown }[] = [];
    a.s.on('notice:new', (n: unknown) => got.push({ who: 'a', n }));
    b.s.on('notice:new', (n: unknown) => got.push({ who: 'b', n }));
    notices.push(a.id, { kind: 'friend_request', from: 'علی' });
    for (let i = 0; i < 50 && got.length === 0; i++) await new Promise((r) => setTimeout(r, 20));
    await new Promise((r) => setTimeout(r, 60));
    expect(got).toHaveLength(1);
    expect(got[0]!.who).toBe('a');
    expect(liveNoticeSchema.parse(got[0]!.n)).toEqual({ kind: 'friend_request', from: 'علی' });
  });
});
