import { describe, expect, it } from 'vitest';
import { ledgerPageSchema, mulberry32 } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { createMemoryLedgerReader } from '../ledger/store.js';
import type { LedgerRow } from '../ledger/store.js';

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

function boot() {
  const auth = new AuthService(memoryUsers(), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
  const rows: Record<string, LedgerRow[]> = {};
  const balances: Record<string, number> = {};
  const app = buildServer({ auth, ledger: createMemoryLedgerReader(rows, balances) });
  const login = async (n: number) => {
    const r = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}` } })).json() as { token: string; user: { id: string } };
    return { h: { authorization: `Bearer ${r.token}` }, id: r.user.id };
  };
  return { app, rows, balances, login };
}

describe('GET /me/ledger', () => {
  it('needs a login', async () => {
    const { app } = boot();
    expect((await app.inject({ method: 'GET', url: '/me/ledger' })).statusCode).toBe(401);
  });

  it('pages newest first with a cursor and shows only the caller’s rows', async () => {
    const { app, rows, balances, login } = boot();
    const a = await login(1);
    const b = await login(2);
    rows[a.id] = [1, 2, 3].map((n) => ({ id: `row-${n}`, delta: n * 10, reason: 'daily_login', createdAt: 1_000 + n }));
    rows[b.id] = [{ id: 'other', delta: 99, reason: 'admin_adjust', createdAt: 5_000 }];
    balances[a.id] = 60;

    const first = ledgerPageSchema.parse((await app.inject({ method: 'GET', url: '/me/ledger?limit=2', headers: a.h })).json());
    expect(first.balance).toBe(60);
    expect(first.items.map((r) => r.id)).toEqual(['row-3', 'row-2']);
    expect(first.next).toBeTruthy();

    const second = ledgerPageSchema.parse((await app.inject({ method: 'GET', url: `/me/ledger?limit=2&before=${first.next}`, headers: a.h })).json());
    expect(second.items.map((r) => r.id)).toEqual(['row-1']);
    expect(second.next).toBeNull();
  });

  it('rejects a malformed cursor', async () => {
    const { app, login } = boot();
    const a = await login(1);
    expect((await app.inject({ method: 'GET', url: '/me/ledger?before=nonsense', headers: a.h })).statusCode).toBe(400);
  });
});
