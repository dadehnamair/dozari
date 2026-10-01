import { describe, expect, it } from 'vitest';
import { mulberry32, transferInfoSchema, transfersSchema } from '@dozari/shared';
import type { TransferRules } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { SocialService } from '../social/service.js';
import { createMemorySocialStore } from '../social/store.js';
import { TransferService } from '../transfers/service.js';
import { createMemoryTransferStore } from '../transfers/store.js';

const DAY = 86_400_000;

function memoryUsers(onCreate: (u: UserRecord) => void): UserRepository {
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
      onCreate(user);
      return user;
    },
    async touch() {},
  };
}

const rules: TransferRules = { gifts: true, loans: true, minFriendDays: 7, minLevel: 5, weeklyCap: 200, minAmount: 10, maxAmount: 100, loanDueDays: 7, loanMaxOpen: 1, needsActivation: true };

function boot(over: Partial<TransferRules> = {}) {
  const seed: { id: string; nickname: string; avatarKey: string; createdAt: number; coins: number }[] = [];
  const store = createMemoryTransferStore();
  const clock = store.now; // one clock for the service and the store
  clock.ms = Date.UTC(2026, 9, 1, 12);
  const socialStore = createMemorySocialStore(seed);
  const social = new SocialService(socialStore, () => clock.ms);
  const levels = new Map<string, number>();
  const activated = new Set<string>();
  // Keep the profile coin count in step with the memory ledger.
  const sync = () => seed.forEach((s) => (s.coins = store.coins.get(s.id) ?? 0));
  const transfers = new TransferService(
    {
      ...store,
      sentSince: async (u, s) => (sync(), store.sentSince(u, s)),
    },
    { pair: (a, b) => socialStore.pair(a, b), publicRow: async (id) => (sync(), socialStore.publicRow(id)) },
    async () => ({ ...rules, ...over }),
    async (id) => levels.get(id) ?? 5,
    async (id) => activated.has(id),
    () => clock.ms,
  );
  const auth = new AuthService(memoryUsers((u) => seed.push({ id: u.id, nickname: u.nickname, avatarKey: u.avatarKey, createdAt: 1, coins: 0 })), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
  const app = buildServer({ auth, social, transfers });
  const login = async (n: number) => {
    const r = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}` } })).json() as { token: string; user: { id: string } };
    activated.add(r.user.id);
    return { h: { authorization: `Bearer ${r.token}` }, id: r.user.id };
  };
  const befriend = async (a: { h: Record<string, string>; id: string }, b: { h: Record<string, string>; id: string }) => {
    await app.inject({ method: 'POST', url: `/friends/${b.id}/request`, headers: a.h });
    await app.inject({ method: 'POST', url: `/friends/${a.id}/accept`, headers: b.h });
  };
  const post = (h: Record<string, string>, url: string, payload?: Record<string, unknown>) => app.inject({ method: 'POST', url, headers: h, payload });
  return { app, clock, store, levels, activated, login, befriend, post };
}

describe('gifts between friends', () => {
  it('sends coins once the friendship is old enough, within the amount and the weekly cap', async () => {
    const { app, clock, store, login, befriend, post } = boot();
    const a = await login(1);
    const b = await login(2);
    store.coins.set(a.id, 500);
    await befriend(a, b);
    expect((await post(a.h, `/friends/${b.id}/gift`, { amount: 50 })).json()).toEqual({ error: 'TOO_NEW' });
    clock.ms += 7 * DAY;
    expect((await post(a.h, `/friends/${b.id}/gift`, { amount: 5 })).json()).toEqual({ error: 'AMOUNT' });
    expect((await post(a.h, `/friends/${b.id}/gift`, { amount: 100 })).statusCode).toBe(200);
    expect(store.coins.get(b.id)).toBe(100);
    expect((await post(a.h, `/friends/${b.id}/gift`, { amount: 100 })).statusCode).toBe(200);
    const capped = await post(a.h, `/friends/${b.id}/gift`, { amount: 10 });
    expect(capped.statusCode).toBe(409);
    expect(capped.json()).toEqual({ error: 'CAP' });
    const info = transferInfoSchema.parse((await app.inject({ method: 'GET', url: '/transfers/rules', headers: a.h })).json());
    expect(info).toMatchObject({ sentThisWeek: 200, leftThisWeek: 0, level: 5, activated: true });
    clock.ms += 7 * DAY + 1;
    expect((await post(a.h, `/friends/${b.id}/gift`, { amount: 10 })).statusCode).toBe(200); // the week rolled over
  });

  it('refuses strangers, low levels, inactive accounts and broke senders', async () => {
    const { clock, store, levels, activated, login, befriend, post } = boot();
    const a = await login(1);
    const b = await login(2);
    const c = await login(3);
    store.coins.set(a.id, 20);
    expect((await post(a.h, `/friends/${b.id}/gift`, { amount: 10 })).json()).toEqual({ error: 'NOT_FRIENDS' });
    await befriend(a, b);
    clock.ms += 8 * DAY;
    levels.set(a.id, 4);
    expect((await post(a.h, `/friends/${b.id}/gift`, { amount: 10 })).json()).toEqual({ error: 'LEVEL' });
    levels.set(a.id, 5);
    activated.delete(a.id);
    expect((await post(a.h, `/friends/${b.id}/gift`, { amount: 10 })).json()).toEqual({ error: 'NOT_ACTIVATED' });
    activated.add(a.id);
    expect((await post(a.h, `/friends/${b.id}/gift`, { amount: 30 })).json()).toEqual({ error: 'INSUFFICIENT' });
    expect((await post(a.h, `/friends/${a.id}/gift`, { amount: 10 })).json()).toEqual({ error: 'NOT_FRIENDS' });
    expect((await post(a.h, `/friends/${c.id}/gift`, { amount: 10 })).statusCode).toBe(403);
    expect((await post({}, `/friends/${b.id}/gift`, { amount: 10 })).statusCode).toBe(401);
  });

  it('can be switched off from the admin settings', async () => {
    const { clock, store, login, befriend, post } = boot({ gifts: false });
    const a = await login(1);
    const b = await login(2);
    store.coins.set(a.id, 500);
    await befriend(a, b);
    clock.ms += 8 * DAY;
    expect((await post(a.h, `/friends/${b.id}/gift`, { amount: 10 })).json()).toEqual({ error: 'OFF' });
  });
});

describe('loans between friends', () => {
  async function friends() {
    const t = boot();
    const a = await t.login(1);
    const b = await t.login(2);
    t.store.coins.set(a.id, 300);
    await t.befriend(a, b);
    t.clock.ms += 8 * DAY;
    return { ...t, a, b };
  }

  it('offer -> accept moves the coins; repay in parts; closes when paid', async () => {
    const { app, store, a, b, post } = await friends();
    const offer = (await post(a.h, `/friends/${b.id}/loan`, { amount: 60 })).json() as { id: string };
    expect(store.coins.get(a.id)).toBe(300); // nothing moved yet
    const mineB = transfersSchema.parse((await app.inject({ method: 'GET', url: '/transfers', headers: b.h })).json()).transfers;
    expect(mineB[0]).toMatchObject({ kind: 'loan', status: 'offered', direction: 'in', amount: 60 });
    expect((await post(b.h, `/loans/${offer.id}/accept`)).statusCode).toBe(200);
    expect([store.coins.get(a.id), store.coins.get(b.id)]).toEqual([240, 60]);
    expect((await post(b.h, `/loans/${offer.id}/accept`)).json()).toEqual({ error: 'BAD_STATE' });
    expect((await post(b.h, `/loans/${offer.id}/repay`, { amount: 25 })).json()).toEqual({ paid: 25, remaining: 35, balance: 35 });
    expect((await post(b.h, `/loans/${offer.id}/repay`, { amount: 100 })).json()).toEqual({ paid: 35, remaining: 0, balance: 0 });
    expect(store.coins.get(a.id)).toBe(300);
    expect(transfersSchema.parse((await app.inject({ method: 'GET', url: '/transfers', headers: a.h })).json()).transfers[0]).toMatchObject({ status: 'repaid', repaid: 60 });
    expect((await post(b.h, `/loans/${offer.id}/repay`, { amount: 1 })).json()).toEqual({ error: 'BAD_STATE' });
  });

  it('only the borrower accepts or declines, only the lender cancels; the offer counts toward the weekly cap', async () => {
    const { a, b, post } = await friends();
    const offer = (await post(a.h, `/friends/${b.id}/loan`, { amount: 100 })).json() as { id: string };
    expect((await post(a.h, `/loans/${offer.id}/accept`)).statusCode).toBe(404);
    expect((await post(b.h, `/loans/${offer.id}/cancel`)).statusCode).toBe(404);
    expect((await post(a.h, `/loans/${offer.id}/decline`)).statusCode).toBe(404);
    expect((await post(a.h, `/friends/${b.id}/gift`, { amount: 100 })).statusCode).toBe(200); // 100 + 100
    expect((await post(a.h, `/friends/${b.id}/gift`, { amount: 10 })).json()).toEqual({ error: 'CAP' });
    expect((await post(a.h, `/loans/${offer.id}/cancel`)).statusCode).toBe(200);
    expect((await post(a.h, `/friends/${b.id}/gift`, { amount: 10 })).statusCode).toBe(200); // cancelled offer frees the cap
    const second = (await post(a.h, `/friends/${b.id}/loan`, { amount: 20 })).json() as { id: string };
    expect((await post(b.h, `/loans/${second.id}/decline`)).statusCode).toBe(200);
  });

  it('allows one open loan per borrower and refuses a lender who can no longer pay', async () => {
    const { store, a, b, post } = await friends();
    const first = (await post(a.h, `/friends/${b.id}/loan`, { amount: 50 })).json() as { id: string };
    expect((await post(a.h, `/friends/${b.id}/loan`, { amount: 50 })).json()).toEqual({ error: 'LOAN_LIMIT' });
    store.coins.set(a.id, 10);
    expect((await post(b.h, `/loans/${first.id}/accept`)).json()).toEqual({ error: 'LENDER_SHORT' });
    expect(store.coins.get(b.id) ?? 0).toBe(0);
  });

  it('takes an overdue loan from the borrower\'s coins and blocks new loans while some is still owed', async () => {
    const { app, clock, store, a, b, post } = await friends();
    const offer = (await post(a.h, `/friends/${b.id}/loan`, { amount: 80 })).json() as { id: string };
    await post(b.h, `/loans/${offer.id}/accept`);
    store.coins.set(b.id, 30); // spent most of it
    clock.ms += 8 * DAY; // past the 7-day due date
    const list = transfersSchema.parse((await app.inject({ method: 'GET', url: '/transfers', headers: b.h })).json()).transfers;
    expect(list[0]).toMatchObject({ status: 'open', repaid: 30, overdue: true });
    expect(store.coins.get(b.id)).toBe(0);
    expect((await post(a.h, `/friends/${b.id}/loan`, { amount: 10 })).json()).toEqual({ error: 'OVERDUE' });
    store.coins.set(b.id, 100);
    await app.inject({ method: 'GET', url: '/transfers', headers: b.h });
    expect(store.coins.get(b.id)).toBe(50); // the remaining 50 was collected
  });
});
