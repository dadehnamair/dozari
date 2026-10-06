import { describe, expect, it } from 'vitest';
import type { LiveNotice } from '@dozari/shared';
import { TABLE_REQUESTS_MAX, tableMinEntry } from '@dozari/shared';
import { createMemoryStakeStore } from '../duel/stakes-store.js';
import { TableService } from '../tables/service.js';
import { TableStakes } from '../tables/stakes.js';

function boot(opts: { kids?: string[] } = {}) {
  const clock = { ms: 1_000_000 };
  const store = createMemoryStakeStore();
  const sent: { to: string; n: LiveNotice }[] = [];
  const started: { boards?: number; fee?: number; priceRounds?: number }[] = [];
  const inMatch = new Set<string>();
  const svc = new TableService({
    profileOf: async (id) => ({ nickname: `p-${id}`, avatarKey: 'avatar-01' }),
    startMatch: async (a, b, o) => (started.push(o ?? {}), inMatch.add(a), inMatch.add(b), true),
    startTeam: async (sides, o) => (started.push(o ?? {}), sides.flat().forEach((u) => inMatch.add(u)), true),
    inMatch: (id) => inMatch.has(id),
    coinsAllowed: async (id) => !opts.kids?.includes(id),
    balanceOf: (id) => store.balance(id),
    notify: (to, n) => sent.push({ to, n }),
    idleMs: async () => 15 * 60_000,
    now: () => clock.ms,
    rng: (() => {
      let i = 0;
      return () => ((i++ * 7) % 31) / 31;
    })(),
  });
  return { svc, store, sent, started, clock, inMatch };
}
const body = { name: 'میز', icon: 'dice' as const, requireReady: false, format: '1v1' as const };

describe('rounds and entry fee', () => {
  it('the minimum entry rises with the rounds; the host must be able to pay it', async () => {
    const t = boot();
    t.store.balances.set('h', 1000);
    expect(await t.svc.create('h', { ...body, rounds: 2, entryFee: tableMinEntry(2) - 1 })).toEqual({ ok: false, error: 'LOW_ENTRY' });
    const ok = await t.svc.create('h', { ...body, rounds: 2, entryFee: tableMinEntry(2) });
    expect(ok.ok && ok.table).toMatchObject({ rounds: 2, entryFee: tableMinEntry(2) });
    const broke = await t.svc.create('poor', { ...body, rounds: 3 });
    expect(broke).toEqual({ ok: false, error: 'NO_COINS' });
  });
  it("an omitted entry means the minimum; a kid's table is free whatever is asked", async () => {
    const t = boot({ kids: ['kid'] });
    t.store.balances.set('h', 1000);
    const a = await t.svc.create('h', { ...body, rounds: 3 });
    expect(a.ok && a.table.entryFee).toBe(tableMinEntry(3));
    const k = await t.svc.create('kid', { ...body, rounds: 3, entryFee: 200 });
    expect(k.ok && k.table).toMatchObject({ entryFee: 0, rounds: 3 });
  });
  it('start passes the rounds and fee on, and refuses when a seated player cannot pay', async () => {
    const t = boot();
    t.store.balances.set('h', 100);
    t.store.balances.set('g', 100);
    const made = await t.svc.create('h', { ...body, rounds: 2, entryFee: 30 });
    if (!made.ok) throw new Error('create');
    await t.svc.join('g', made.table.code);
    t.store.balances.set('g', 10); // spent it meanwhile
    expect(await t.svc.start('h')).toEqual({ ok: false, error: 'NO_COINS' });
    t.store.balances.set('g', 40);
    expect(await t.svc.start('h')).toEqual({ ok: true });
    expect(t.started).toEqual([{ boards: 2, fee: 30, priceRounds: 4 }]);
  });
});

describe('price questions of a table', () => {
  it('a 1v1 host picks how many (0 = none); the choice is clamped and reaches the match; a 2v2 has none', async () => {
    const t = boot();
    for (const u of ['a', 'b', 'c']) t.store.balances.set(u, 100);
    const none = await t.svc.create('a', { ...body, priceRounds: 0 });
    expect(none.ok && none.table.priceRounds).toBe(0);
    const two = await t.svc.create('b', { ...body, priceRounds: 2 });
    expect(two.ok && two.table.priceRounds).toBe(2);
    const many = await t.svc.create('c', { ...body, priceRounds: 99 });
    expect(many.ok && many.table.priceRounds).toBe(4);
    const team = await t.svc.create('a', { ...body, format: '2v2', priceRounds: 3 });
    expect(team.ok && team.table.priceRounds).toBe(0);
    if (!two.ok) throw new Error('create');
    await t.svc.join('c', two.table.code);
    await t.svc.start('b');
    expect(t.started.at(-1)).toMatchObject({ priceRounds: 2 });
  });
});

describe('open tables and requests', () => {
  it('tables are public unless marked private', async () => {
    const t = boot();
    t.store.balances.set('h', 100);
    t.store.balances.set('p', 100);
    await t.svc.create('h', body);
    await t.svc.create('p', { ...body, isPrivate: true });
    expect((await t.svc.listPublic('viewer')).map((r) => [r.hostNickname, r.status])).toEqual([['p-h', 'open']]);
  });
  it('full and locked tables stay listed with their status; a closed one lingers as closed (view only)', async () => {
    const t = boot();
    for (const u of ['h1', 'h2', 'h3', 'g1']) t.store.balances.set(u, 100);
    const a = await t.svc.create('h1', body);
    const b = await t.svc.create('h2', body);
    const c = await t.svc.create('h3', body);
    if (!a.ok || !b.ok || !c.ok) throw new Error('create');
    await t.svc.join('g1', a.table.code);
    await t.svc.setLocked('h2', true);
    t.svc.leave('h3'); // closed
    const rows = await t.svc.listPublic('viewer');
    expect(rows.map((r) => r.status)).toEqual(['full', 'locked', 'closed']);
    expect(await t.svc.request('viewer', a.table.code)).toEqual({ ok: false, error: 'FULL' });
    expect(await t.svc.request('viewer', b.table.code)).toEqual({ ok: false, error: 'LOCKED' });
    t.clock.ms += 16 * 60_000; // the idle tables time out and are listed as closed from now on
    expect((await t.svc.listPublic('viewer')).map((r) => r.status)).toEqual(['closed', 'closed', 'closed']);
    t.clock.ms += 31 * 60_000;
    expect(await t.svc.listPublic('viewer')).toEqual([]);
  });
  it('a request waits for the host, who is nudged; accepting seats the asker, declining tells them', async () => {
    const t = boot();
    for (const u of ['h', 'a', 'b']) t.store.balances.set(u, 100);
    const made = await t.svc.create('h', body);
    if (!made.ok) throw new Error('create');
    expect(await t.svc.request('a', made.table.code)).toEqual({ ok: true });
    expect(await t.svc.request('a', made.table.code)).toEqual({ ok: true }); // idempotent
    expect(t.sent.filter((s) => s.to === 'h')).toHaveLength(1);
    expect(t.sent[0]!.n).toMatchObject({ kind: 'table_request', from: 'p-a', code: made.table.code });
    expect((await t.svc.get('h', made.table.code))?.requests.map((r) => r.id)).toEqual(['a']);
    expect((await t.svc.get('a', made.table.code))?.requests).toEqual([]);
    expect(await t.svc.answer('a', 'a', true)).toEqual({ ok: false, error: 'NOT_HOST' });
    expect(await t.svc.answer('h', 'b', true)).toEqual({ ok: false, error: 'NOT_REQUESTED' });
    expect(await t.svc.answer('h', 'a', true)).toEqual({ ok: true });
    expect((await t.svc.mine('a'))?.players.map((p) => p.id)).toEqual(['h', 'a']);
    expect(t.sent.at(-1)).toMatchObject({ to: 'a', n: { kind: 'table_answer', accepted: true } });
    // a second asker is turned down
    const second = await t.svc.create('b', body);
    if (!second.ok) throw new Error('create');
    await t.svc.request('h', second.table.code);
    expect(await t.svc.answer('b', 'h', false)).toEqual({ ok: true });
    expect(t.sent.at(-1)).toMatchObject({ to: 'h', n: { kind: 'table_answer', accepted: false } });
    expect((await t.svc.listPublic('h')).find((r) => r.code === second.table.code)?.yourRequest).toBe('denied');
    t.clock.ms += 61_000;
    expect((await t.svc.listPublic('h')).find((r) => r.code === second.table.code)?.yourRequest).toBe('none');
  });
  it('caps waiting requests, lapses old ones, and asks nothing of a private table or someone short of coins', async () => {
    const t = boot();
    t.store.balances.set('h', 100);
    t.store.balances.set('p', 100);
    const made = await t.svc.create('h', body);
    const priv = await t.svc.create('p', { ...body, isPrivate: true });
    if (!made.ok || !priv.ok) throw new Error('create');
    for (let i = 0; i < TABLE_REQUESTS_MAX; i++) {
      t.store.balances.set(`r${i}`, 100);
      expect(await t.svc.request(`r${i}`, made.table.code)).toEqual({ ok: true });
    }
    t.store.balances.set('late', 100);
    expect(await t.svc.request('late', made.table.code)).toEqual({ ok: false, error: 'TOO_MANY' });
    expect(await t.svc.request('nocoins', made.table.code)).toEqual({ ok: false, error: 'NO_COINS' });
    expect(await t.svc.request('late', priv.table.code)).toEqual({ ok: false, error: 'NOT_FOUND' });
    t.clock.ms += 3 * 60_000;
    expect((await t.svc.get('h', made.table.code))?.requests).toEqual([]);
  });
});

describe('TableStakes', () => {
  it('takes every fee or none, pays the winners once, refunds a draw', async () => {
    const store = createMemoryStakeStore();
    const stakes = new TableStakes(store, () => 10);
    for (const u of ['a', 'b', 'c', 'd']) store.balances.set(u, 50);
    store.balances.set('d', 10);
    expect(await stakes.open('m1', ['a', 'b', 'c', 'd'], 20)).toBe(false);
    expect([...'abcd'].map((u) => store.balances.get(u))).toEqual([50, 50, 50, 10]); // all taken fees came back
    store.balances.set('d', 50);
    expect(await stakes.open('m2', ['a', 'b', 'c', 'd'], 20)).toBe(true);
    await stakes.settle('m2', [['a', 'b'], ['c', 'd']], 20, { winner: 0 });
    await stakes.settle('m2', [['a', 'b'], ['c', 'd']], 20, { winner: 0 }); // twice: idempotent
    expect([...'abcd'].map((u) => store.balances.get(u))).toEqual([66, 66, 30, 30]);
    await stakes.open('m3', ['a', 'c'], 10);
    await stakes.settle('m3', [['a'], ['c']], 10, { winner: null });
    expect([store.balances.get('a'), store.balances.get('c')]).toEqual([66, 30]);
  });
});
