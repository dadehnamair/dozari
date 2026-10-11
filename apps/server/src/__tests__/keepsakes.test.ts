import { describe, expect, it } from 'vitest';
import { KEEPSAKE_RARITIES, keepsakeGallerySchema, mulberry32, showcaseViewSchema } from '@dozari/shared';
import { KEEPSAKE_RARITY_VALUES } from '@dozari/db';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { createMemoryKeepsakeStore } from '../keepsakes/memory.js';
import type { NewDef } from '../keepsakes/store.js';
import { KeepsakeService } from '../keepsakes/service.js';

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

const def = (over: Partial<NewDef> = {}): NewDef => ({ productId: null, titleFa: 'یادگار', storyFa: 'یک داستان', eraYear: 1360, rarity: 'common', pieces: 4, artKey: null, setId: null, rewardGems: 3, isActive: true, ...over });

function boot(defs: NewDef[], sets: { id: string; titleFa: string; rewardGems: number; isActive: boolean }[] = []) {
  const store = createMemoryKeepsakeStore(defs, sets);
  let n = 0;
  const service = new KeepsakeService(store, async () => 1, () => `ref-${++n}`);
  const auth = new AuthService(memoryUsers(), createTokenSigner('a-test-secret-that-is-long-enough'), mulberry32(3));
  const app = buildServer({ auth, keepsakes: service });
  const login = async (i: number) => {
    const r = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: `0f8fad5b-d9cb-469f-a165-7086772895${String(i).padStart(2, '0')}` } })).json() as { token: string; user: { id: string } };
    return { h: { authorization: `Bearer ${r.token}` }, id: r.user.id };
  };
  return { app, store, service, login };
}

describe('keepsake rarity list', () => {
  it('matches the copy in the DB schema', () => {
    expect([...KEEPSAKE_RARITY_VALUES]).toEqual([...KEEPSAKE_RARITIES]);
  });
});

describe('keepsake gallery and shop', () => {
  it('lists keepsakes with progress and prices', async () => {
    const { app, login } = boot([def(), def({ rarity: 'legendary', pieces: 6 })]);
    const a = await login(1);
    const g = keepsakeGallerySchema.parse((await app.inject({ method: 'GET', url: '/keepsakes', headers: a.h })).json());
    expect(g).toMatchObject({ total: 2, completed: 0, percent: 0 });
    expect(g.items.map((i) => [i.piecePrice, i.pieces])).toEqual([[60, 4], [240, 6]]);
  });
  it('buys a missing piece with coins until the keepsake is complete, then pays its gems once', async () => {
    const { app, store, login } = boot([def({ rewardGems: 5 })]);
    const a = await login(1);
    store.give(a.id, 1000);
    const id = (keepsakeGallerySchema.parse((await app.inject({ method: 'GET', url: '/keepsakes', headers: a.h })).json())).items[0]!.id;
    const pieces: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await app.inject({ method: 'POST', url: `/keepsakes/${id}/piece`, headers: a.h });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { piece: number; completed: boolean; gems: number };
      pieces.push(body.piece);
      expect(body.completed).toBe(i === 3);
      expect(body.gems).toBe(i === 3 ? 5 : 0);
    }
    expect([...pieces].sort()).toEqual([1, 2, 3, 4]);
    expect(store.coins.get(a.id)).toBe(1000 - 4 * 60);
    expect(store.gems.get(a.id)).toBe(5);
    expect((await app.inject({ method: 'POST', url: `/keepsakes/${id}/piece`, headers: a.h })).statusCode).toBe(409);
    const g = keepsakeGallerySchema.parse((await app.inject({ method: 'GET', url: '/keepsakes', headers: a.h })).json());
    expect(g).toMatchObject({ completed: 1, percent: 100 });
    expect(g.items[0]).toMatchObject({ complete: true, level: 1, piecePrice: 0, upgradePrice: 150 });
  });
  it('refuses a purchase without enough coins and takes nothing', async () => {
    const { app, store, login } = boot([def()]);
    const a = await login(1);
    store.give(a.id, 59);
    const id = (keepsakeGallerySchema.parse((await app.inject({ method: 'GET', url: '/keepsakes', headers: a.h })).json())).items[0]!.id;
    const res = await app.inject({ method: 'POST', url: `/keepsakes/${id}/piece`, headers: a.h });
    expect(res.statusCode).toBe(402);
    expect(store.coins.get(a.id)).toBe(59);
    expect(store.ledger).toEqual([]);
  });
  it('pays a set reward once, when its last keepsake is completed', async () => {
    const setId = '00000000-0000-7000-8000-0000000000aa';
    const { app, store, login } = boot([def({ setId, rewardGems: 1, pieces: 1 }), def({ setId, rewardGems: 1, pieces: 1 })], [{ id: setId, titleFa: 'دهه‌ی شصت', rewardGems: 10, isActive: true }]);
    const a = await login(1);
    store.give(a.id, 500);
    const g = keepsakeGallerySchema.parse((await app.inject({ method: 'GET', url: '/keepsakes', headers: a.h })).json());
    await app.inject({ method: 'POST', url: `/keepsakes/${g.items[0]!.id}/piece`, headers: a.h });
    expect(store.gems.get(a.id)).toBe(1);
    await app.inject({ method: 'POST', url: `/keepsakes/${g.items[1]!.id}/piece`, headers: a.h });
    // 1 + 1 for the keepsakes, 10 for the set, 5 for the «two completed» milestone
    expect(store.gems.get(a.id)).toBe(17);
    expect(keepsakeGallerySchema.parse((await app.inject({ method: 'GET', url: '/keepsakes', headers: a.h })).json()).sets[0]).toMatchObject({ total: 2, completed: 2, rewardGems: 10 });
  });
});

describe('collection milestones', () => {
  it('pays each milestone once when enough keepsakes are complete, tells the buyer, and gives its spins', async () => {
    const store = createMemoryKeepsakeStore(Array.from({ length: 4 }, () => def({ rewardGems: 0, pieces: 1 })));
    const spins: { id: string; ref: string; n: number }[] = [];
    let n = 0;
    const service = new KeepsakeService(store, async () => 0, () => `ref-${++n}`, async (id, ref, count) => void spins.push({ id, ref, n: count }));
    store.give('u', 1000);
    const g0 = await service.gallery('u');
    expect(g0.milestones.map((m) => [m.count, m.reached])).toEqual([[2, false], [4, false], [6, false], [8, false]]);
    const first = await service.buyPiece('u', g0.items[0]!.id);
    expect(first.ok && first.milestones).toEqual([]);
    const second = await service.buyPiece('u', g0.items[1]!.id);
    expect(second.ok && second.milestones).toEqual([{ count: 2, gems: 5, spins: 0 }]);
    expect(store.gems.get('u')).toBe(5);
    await service.buyPiece('u', g0.items[2]!.id);
    const fourth = await service.buyPiece('u', g0.items[3]!.id);
    expect(fourth.ok && fourth.milestones).toEqual([{ count: 4, gems: 10, spins: 1 }]);
    expect(spins).toEqual([{ id: 'u', ref: 'keepsake-milestone-4', n: 1 }]);
    expect(store.gems.get('u')).toBe(15);
    expect((await service.gallery('u')).milestones.filter((m) => m.reached).map((m) => m.count)).toEqual([2, 4]);
  });
});

describe('keepsake upgrade and showcase', () => {
  async function owned(n: number) {
    const t = boot(Array.from({ length: n }, () => def({ pieces: 1, rewardGems: 0 })));
    const a = await t.login(1);
    t.store.give(a.id, 5000);
    const ids = (keepsakeGallerySchema.parse((await t.app.inject({ method: 'GET', url: '/keepsakes', headers: a.h })).json())).items.map((i) => i.id);
    for (const id of ids) await t.app.inject({ method: 'POST', url: `/keepsakes/${id}/piece`, headers: a.h });
    return { ...t, a, ids };
  }
  it('upgrades a completed keepsake twice and then refuses', async () => {
    const { app, store, a, ids } = await owned(1);
    const before = store.coins.get(a.id)!;
    expect((await app.inject({ method: 'POST', url: `/keepsakes/${ids[0]}/upgrade`, headers: a.h })).json()).toMatchObject({ ok: true, level: 2 });
    expect((await app.inject({ method: 'POST', url: `/keepsakes/${ids[0]}/upgrade`, headers: a.h })).json()).toMatchObject({ ok: true, level: 3 });
    expect(store.coins.get(a.id)).toBe(before - 150 - 300);
    expect((await app.inject({ method: 'POST', url: `/keepsakes/${ids[0]}/upgrade`, headers: a.h })).statusCode).toBe(409);
  });
  it('refuses to upgrade what is not complete', async () => {
    const t = boot([def()]);
    const a = await t.login(1);
    t.store.give(a.id, 5000);
    const id = (keepsakeGallerySchema.parse((await t.app.inject({ method: 'GET', url: '/keepsakes', headers: a.h })).json())).items[0]!.id;
    expect((await t.app.inject({ method: 'POST', url: `/keepsakes/${id}/upgrade`, headers: a.h })).statusCode).toBe(409);
  });
  it('pins completed keepsakes in order and shows them to others; rejects the rest', async () => {
    const { app, login, a, ids } = await owned(3);
    const b = await login(2);
    const put = (list: string[]) => app.inject({ method: 'PUT', url: '/me/showcase', headers: a.h, payload: { ids: list } });
    expect((await put([ids[2]!, ids[0]!])).statusCode).toBe(200);
    const seen = showcaseViewSchema.parse((await app.inject({ method: 'GET', url: `/players/${a.id}/showcase`, headers: b.h })).json());
    expect(seen.items.map((i) => i.id)).toEqual([ids[2], ids[0]]);
    expect(seen).toMatchObject({ completed: 3, total: 3, percent: 100 });
    expect((await put([ids[0]!, ids[0]!])).statusCode).toBe(400);
    expect((await put(['00000000-0000-7000-8000-0000000000ff'])).statusCode).toBe(400);
    expect((await put([])).statusCode).toBe(200);
    expect(showcaseViewSchema.parse((await app.inject({ method: 'GET', url: `/players/${a.id}/showcase`, headers: b.h })).json()).items).toEqual([]);
  });
});

describe('keepsake drop on a win', () => {
  it('drops a piece once per match, however often it is settled', async () => {
    const { service, store, login } = boot([def()]);
    void login;
    const u = '00000000-0000-7000-8000-0000000000b1';
    const first = await service.dropForWin(u, 'match-1');
    expect(first).toMatchObject({ piece: expect.any(Number) });
    expect(await service.dropForWin(u, 'match-1')).toBeNull();
    expect((await store.progress(u)).get(first!.keepsakeId)!.owned).toHaveLength(1);
  });
  it('drops nothing when the chance is zero', async () => {
    const store = createMemoryKeepsakeStore([def()]);
    const service = new KeepsakeService(store, async () => 0);
    expect(await service.dropForWin('00000000-0000-7000-8000-0000000000b1', 'm')).toBeNull();
  });
});
