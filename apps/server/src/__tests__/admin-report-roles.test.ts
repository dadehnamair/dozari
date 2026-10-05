import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { AdminAccounts } from '../admin/accounts/service.js';
import { createMemoryAdminStore } from '../admin/accounts/store.js';
import { createMemoryAuditLog } from '../admin/audit.js';
import { createMemoryChatStore } from '../chat/store.js';

const LEGACY = 'legacy-admin-token-0123456789';
const PW = 'correct horse battery';

async function boot() {
  const chat = createMemoryChatStore();
  chat.tracks.set('kid1', 'kid');
  const kidLine = await chat.addMessage({ room: 'dm', roomKey: 'kid1:kid2', userId: 'kid1', kind: 'text', text: 'خط گزارش‌شده‌ی کودک' });
  const adultLine = await chat.addMessage({ room: 'city', roomKey: 'c1', userId: 'adult1', kind: 'text', text: 'خط بزرگسال' });
  await chat.report(kidLine.id, 'kid2', 'مزاحمت');
  await chat.report(adultLine.id, 'adult2', 'تبلیغ');
  const accounts = new AdminAccounts(createMemoryAdminStore(), 'a-test-secret-that-is-long-enough', LEGACY, () => 1_700_000_000_000);
  const app = buildServer({
    admin: { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' }, token: LEGACY, accounts },
    adminModules: { audit: createMemoryAuditLog(), chat },
  });
  const legacy = { 'x-admin-token': LEGACY };
  const tokenOf = async (username: string, role: string) => {
    await app.inject({ method: 'POST', url: '/admin/admins', headers: legacy, payload: { username, displayName: username, password: PW, role } });
    const r = await app.inject({ method: 'POST', url: '/admin/login', payload: { username, password: PW } });
    return { 'x-admin-token': (r.json() as { token: string }).token };
  };
  return { app, tokenOf, legacy };
}

describe('kid/teen report queue is for moderating roles only', () => {
  it('shows it to support and the owner, and gives a viewer only the adult reports whatever they ask', async () => {
    const { app, tokenOf, legacy } = await boot();
    const texts = async (headers: Record<string, string>, queue: string) => {
      const body = (await app.inject({ method: 'GET', url: `/admin/chat/reports?queue=${queue}`, headers })).json() as { reports: { messageText: string }[]; minorsQueue: boolean };
      return { lines: body.reports.map((r) => r.messageText).sort(), minorsQueue: body.minorsQueue };
    };
    const support = await tokenOf('sam', 'support');
    const viewer = await tokenOf('vera', 'viewer');
    expect(await texts(legacy, 'minors')).toEqual({ lines: ['خط گزارش‌شده‌ی کودک'], minorsQueue: true });
    expect(await texts(support, 'minors')).toEqual({ lines: ['خط گزارش‌شده‌ی کودک'], minorsQueue: true });
    expect((await texts(support, 'all')).lines).toHaveLength(2);
    for (const queue of ['minors', 'all', 'adults']) expect(await texts(viewer, queue)).toEqual({ lines: ['خط بزرگسال'], minorsQueue: false });
  });
});
