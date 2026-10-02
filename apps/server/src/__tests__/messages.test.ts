import { describe, expect, it } from 'vitest';
import { inboxSchema, mulberry32 } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { createMemoryAuditLog } from '../admin/audit.js';
import { MessageCenter } from '../messages/service.js';
import { createMemoryMessageStore } from '../messages/store.js';
import { NotifyService } from '../notify/service.js';
import { createMemoryNotifyStore } from '../notify/store.js';

const TOKEN = 'secret-admin-token';

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

async function boot(baleConfigured = true) {
  const auth = new AuthService(memoryUsers(), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
  const sentToBale: string[] = [];
  const notifyStore = createMemoryNotifyStore();
  const bale = new NotifyService(notifyStore, baleConfigured ? { sendMessage: async (_c, t) => void sentToBale.push(t), getUpdates: async () => [] } : null, Date.now, () => 'ABC234');
  const login = async (n: number) => {
    const r = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}` } })).json() as { token: string; user: { id: string } };
    return { h: { authorization: `Bearer ${r.token}` }, id: r.user.id };
  };
  // users must exist before the store is seeded, so the center reads the live user list
  const known: string[] = [];
  const baleLinked: string[] = [];
  const store = createMemoryMessageStore({ users: known, baleLinked });
  const center = new MessageCenter(store, bale);
  const audit = createMemoryAuditLog();
  const app = buildServer({
    auth,
    messages: center,
    admin: { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' }, token: TOKEN },
    adminModules: { audit, messages: center },
  });
  return { app, center, bale, notifyStore, known, baleLinked, sentToBale, login, admin: { 'x-admin-token': TOKEN } };
}

describe('message center', () => {
  it('lists channels and marks the unready ones unavailable with a reason', async () => {
    const { app, admin } = await boot(false);
    const res = (await app.inject({ method: 'GET', url: '/admin/messages/channels', headers: admin })).json() as { channels: { channel: string; available: boolean; reason: string | null }[] };
    const by = Object.fromEntries(res.channels.map((c) => [c.channel, c]));
    expect(by.in_app!.available).toBe(true);
    expect(by.bale!.available).toBe(false);
    for (const c of ['sms', 'email', 'push']) expect(by[c]!.reason).toBeTruthy();
  });

  it('sends to every player inbox, players read and mark read, admin retracts', async () => {
    const { app, login, known, admin } = await boot();
    const a = await login(1);
    const b = await login(2);
    known.push(a.id, b.id);
    const sent = await app.inject({ method: 'POST', url: '/admin/messages', headers: admin, payload: { title: 'سلام', body: 'خبر خوب', audience: 'all', channels: ['in_app'] } });
    expect(sent.statusCode).toBe(201);
    expect(sent.json().recipients).toEqual({ in_app: 2 });
    const inbox = inboxSchema.parse((await app.inject({ method: 'GET', url: '/inbox', headers: a.h })).json());
    expect(inbox.unread).toBe(1);
    expect(inbox.items[0]).toMatchObject({ title: 'سلام', body: 'خبر خوب', read: false });
    expect((await app.inject({ method: 'POST', url: `/inbox/${inbox.items[0]!.id}/read`, headers: a.h })).statusCode).toBe(200);
    expect(inboxSchema.parse((await app.inject({ method: 'GET', url: '/inbox', headers: a.h })).json()).unread).toBe(0);
    expect((await app.inject({ method: 'POST', url: `/inbox/${inbox.items[0]!.id}/read`, headers: b.h })).statusCode).toBe(404); // not b's row
    expect((await app.inject({ method: 'GET', url: '/inbox' })).statusCode).toBe(401);

    const history = (await app.inject({ method: 'GET', url: '/admin/messages', headers: admin })).json().messages;
    expect(history[0]).toMatchObject({ title: 'سلام', retracted: false, channels: [{ channel: 'in_app', recipients: 2 }] });
    expect((await app.inject({ method: 'DELETE', url: `/admin/messages/${history[0].id}`, headers: admin })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `/admin/messages/${history[0].id}`, headers: admin })).statusCode).toBe(404);
    expect(inboxSchema.parse((await app.inject({ method: 'GET', url: '/inbox', headers: b.h })).json()).items).toEqual([]);
  });

  it('also goes out on Bale to linked players, and can target one player', async () => {
    const { app, login, known, baleLinked, bale, center, sentToBale, admin } = await boot();
    const a = await login(1);
    const b = await login(2);
    known.push(a.id, b.id);
    await bale.linkCode(a.id);
    await bale.handleUpdate({ update_id: 1, message: { message_id: 1, chat: { id: 77 }, text: 'ABC234' } });
    baleLinked.push(a.id);
    const out = await app.inject({ method: 'POST', url: '/admin/messages', headers: admin, payload: { title: 'T', body: 'B', audience: 'all', channels: ['in_app', 'bale'] } });
    expect(out.json().recipients).toEqual({ in_app: 2, bale: 1 });
    await bale.flush();
    expect(sentToBale).toContain('T\n\nB');
    const one = await app.inject({ method: 'POST', url: '/admin/messages', headers: admin, payload: { title: 'x', body: 'y', audience: 'user', targetUserId: b.id, channels: ['in_app'] } });
    expect(one.json().recipients).toEqual({ in_app: 1 });
    expect(await center.unread(a.id)).toBe(1);
    expect(await center.unread(b.id)).toBe(2);
  });

  it('refuses unavailable channels, empty audiences and bad input', async () => {
    const { app, login, known, admin } = await boot(false);
    const a = await login(1);
    known.push(a.id);
    const send = (payload: object) => app.inject({ method: 'POST', url: '/admin/messages', headers: admin, payload });
    expect((await send({ title: 'T', body: 'B', audience: 'all', channels: ['bale'] })).statusCode).toBe(400);
    expect((await send({ title: 'T', body: 'B', audience: 'all', channels: ['sms'] })).json()).toEqual({ error: 'channel_unavailable' });
    expect((await send({ title: 'T', body: 'B', audience: 'user', targetUserId: '00000000-0000-7000-8000-0000000000ff', channels: ['in_app'] })).statusCode).toBe(409);
    expect((await send({ title: 'T', body: 'B', audience: 'user', channels: ['in_app'] })).statusCode).toBe(400);
    expect((await send({ title: '', body: 'B', audience: 'all', channels: ['in_app'] })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/admin/messages', payload: {} })).statusCode).toBe(401);
  });
});
