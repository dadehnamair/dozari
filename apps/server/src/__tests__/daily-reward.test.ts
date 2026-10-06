import { describe, expect, it } from 'vitest';
import { DEFAULT_DAILY_REWARD_STEPS, mulberry32 } from '@dozari/shared';
import type { DailyRewardState } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { DailyRewardService, decideClaim } from '../economy/daily-reward.js';
import type { ClaimResult, DailyRewardStore } from '../economy/daily-reward.js';

const H = 3_600_000;
const DEVICE = '0f8fad5b-d9cb-469f-a165-70867728950e';

/** In-memory twin of the DB store: same `decideClaim`, claims serialised per player. */
function memoryStore() {
  let steps: number[] | null = null;
  const states = new Map<string, DailyRewardState & { claims: number }>();
  const balances = new Map<string, number>();
  const ledger: { key: string; delta: number }[] = [];
  const store: DailyRewardStore = {
    async getSteps() {
      return steps;
    },
    async setSteps(s) {
      steps = s;
    },
    async getState(userId) {
      const st = states.get(userId);
      return {
        state: st ? { lastClaimedAt: st.lastClaimedAt, streakDay: st.streakDay } : { lastClaimedAt: null, streakDay: 0 },
        balance: balances.get(userId) ?? 0,
      };
    },
    async claim(userId, now, stepList, rules): Promise<ClaimResult> {
      const cur = states.get(userId) ?? { lastClaimedAt: null, streakDay: 0, claims: 0 };
      const d = decideClaim({ lastClaimedAt: cur.lastClaimedAt, streakDay: cur.streakDay }, stepList, now, rules);
      if (d.kind === 'disabled') return { ok: false, error: 'DISABLED' };
      if (d.kind === 'wait') return { ok: false, error: 'TOO_EARLY', nextClaimAt: d.nextClaimAt };
      const claims = cur.claims + 1;
      states.set(userId, { ...d.next, claims });
      ledger.push({ key: `daily_login:${claims}:${userId}`, delta: d.coins });
      const balance = (balances.get(userId) ?? 0) + d.coins;
      balances.set(userId, balance);
      return { ok: true, day: d.day, coins: d.coins, balance, nextClaimAt: d.nextClaimAt };
    },
  };
  return { store, ledger };
}

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

function setup() {
  let clock = 1_700_000_000_000;
  const { store, ledger } = memoryStore();
  const daily = new DailyRewardService(store, () => clock);
  const auth = new AuthService(memoryUsers(), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(2));
  const app = buildServer({ auth, dailyReward: daily });
  return {
    app,
    daily,
    ledger,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

async function login(app: ReturnType<typeof setup>['app']) {
  const r = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: DEVICE } })).json() as { token: string };
  return { authorization: `Bearer ${r.token}` };
}

describe('daily reward routes', () => {
  it('needs a logged-in player', async () => {
    const { app } = setup();
    expect((await app.inject({ method: 'GET', url: '/daily-reward' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/daily-reward/claim' })).statusCode).toBe(401);
  });

  it('shows the card before the first claim', async () => {
    const { app } = setup();
    const res = await app.inject({ method: 'GET', url: '/daily-reward', headers: await login(app) });
    expect(res.json()).toEqual({ canClaim: true, day: 1, coins: 10, nextClaimAt: null, steps: [...DEFAULT_DAILY_REWARD_STEPS], balance: 0, shields: 0 });
  });

  it('pays 10, 15, 20, 20 on consecutive days and refuses a second claim within 24 hours', async () => {
    const { app, advance, ledger } = setup();
    const headers = await login(app);
    const claim = async () => app.inject({ method: 'POST', url: '/daily-reward/claim', headers });
    const paid: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await claim();
      expect(res.statusCode).toBe(200);
      paid.push((res.json() as { coins: number }).coins);
      const again = await claim();
      expect(again.statusCode).toBe(409);
      expect(again.json()).toMatchObject({ ok: false, error: 'TOO_EARLY' });
      advance(25 * H);
    }
    expect(paid).toEqual([10, 15, 20, 20]);
    expect(ledger.map((l) => l.delta)).toEqual([10, 15, 20, 20]);
    expect(new Set(ledger.map((l) => l.key)).size).toBe(4);
  });

  it('starts over at 10 after a whole day is missed', async () => {
    const { app, advance } = setup();
    const headers = await login(app);
    const claim = async () => (await app.inject({ method: 'POST', url: '/daily-reward/claim', headers })).json() as { coins: number; balance: number };
    await claim();
    advance(25 * H);
    expect((await claim()).coins).toBe(15);
    advance(49 * H); // skipped a day
    const back = await claim();
    expect(back.coins).toBe(10);
    expect(back.balance).toBe(10 + 15 + 10);
  });

  it('two taps at once pay once', async () => {
    const { app, ledger } = setup();
    const headers = await login(app);
    const results = await Promise.all([1, 2, 3].map(() => app.inject({ method: 'POST', url: '/daily-reward/claim', headers })));
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409, 409]);
    expect(ledger).toHaveLength(1);
  });

  it('shows when the next claim opens', async () => {
    const { app, advance } = setup();
    const headers = await login(app);
    await app.inject({ method: 'POST', url: '/daily-reward/claim', headers });
    advance(5 * H);
    const status = (await app.inject({ method: 'GET', url: '/daily-reward', headers })).json() as {
      canClaim: boolean;
      day: number;
      coins: number;
      nextClaimAt: number;
    };
    expect(status).toMatchObject({ canClaim: false, day: 2, coins: 15 });
    expect(status.nextClaimAt).toBe(1_700_000_000_000 + 24 * H);
  });
});

describe('admin editor', () => {
  const admin = { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' as const }, token: 'secret-admin-token' };
  function adminApp() {
    const { daily } = setup();
    return { daily, app: buildServer({ dailyReward: daily, admin }) };
  }
  const h = { 'x-admin-token': admin.token };

  it('needs the admin token', async () => {
    const { app } = adminApp();
    expect((await app.inject({ method: 'GET', url: '/admin/daily-reward' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'PUT', url: '/admin/daily-reward', payload: { steps: [1] } })).statusCode).toBe(401);
  });

  it('reads the defaults, saves new amounts and the player card follows', async () => {
    const { app, daily } = adminApp();
    expect((await app.inject({ method: 'GET', url: '/admin/daily-reward', headers: h })).json()).toEqual({ steps: [10, 15, 20] });
    const put = await app.inject({ method: 'PUT', url: '/admin/daily-reward', headers: h, payload: { steps: [5, 50, 500, 1000] } });
    expect(put.json()).toEqual({ steps: [5, 50, 500, 1000] });
    expect(await daily.steps()).toEqual([5, 50, 500, 1000]);
  });

  it('refuses nonsense amounts', async () => {
    const { app } = adminApp();
    for (const steps of [[], [0], [-1], [1.5], [10_001], Array(61).fill(10), ['10'], 'x']) {
      expect((await app.inject({ method: 'PUT', url: '/admin/daily-reward', headers: h, payload: { steps } })).statusCode).toBe(400);
    }
  });
});
