import { describe, expect, it } from 'vitest';
import { TableService } from '../tables/service.js';

function boot() {
  const clock = { ms: 1_000_000 };
  const inMatch = new Set<string>();
  const started: [string, string][] = [];
  const teams: string[][][] = [];
  let fail = false;
  const svc = new TableService({
    profileOf: async (id) => ({ nickname: `p-${id}`, avatarKey: 'avatar-01' }),
    startTeam: async (sides) => {
      teams.push(sides.map((x) => [...x]));
      for (const u of sides.flat()) inMatch.add(u);
      return true;
    },
    startMatch: async (a, b) => {
      if (fail) return false;
      started.push([a, b]);
      inMatch.add(a);
      inMatch.add(b);
      return true;
    },
    inMatch: (id) => inMatch.has(id),
    idleMs: async () => 15 * 60_000,
    now: () => clock.ms,
    rng: (() => {
      let i = 0;
      return () => ((i++ * 7) % 31) / 31;
    })(),
  });
  return { svc, clock, inMatch, started, teams, setFail: (v: boolean) => (fail = v) };
}
const body = { name: 'میز علی', icon: 'dice' as const, requireReady: false, format: '1v1' as const };

describe('private tables', () => {
  it('host creates, guest joins by a typed code, host starts a duel', async () => {
    const t = boot();
    const made = await t.svc.create('host', body);
    if (!made.ok) throw new Error('create');
    expect(made.table).toMatchObject({ youAreHost: true, locked: false, seats: 2 });
    expect((await t.svc.start('host')).ok).toBe(false);
    const j = await t.svc.join('guest', ` ${made.table.code.toLowerCase()} `);
    expect(j.ok && j.table.players.map((p) => p.id)).toEqual(['host', 'guest']);
    expect(await t.svc.start('host')).toEqual({ ok: true });
    expect(t.started).toEqual([['host', 'guest']]);
    expect((await t.svc.mine('guest'))?.inMatch).toBe(true);
  });
  it('refuses a third player, a locked table, and a guest starting', async () => {
    const t = boot();
    const made = await t.svc.create('host', body);
    if (!made.ok) throw new Error('create');
    const code = made.table.code;
    await t.svc.join('g1', code);
    expect(await t.svc.join('g2', code)).toEqual({ ok: false, error: 'FULL' });
    expect(await t.svc.start('g1')).toEqual({ ok: false, error: 'NOT_HOST' });
    t.svc.kick('host', 'g1');
    await t.svc.setLocked('host', true);
    expect(await t.svc.join('g2', code)).toEqual({ ok: false, error: 'LOCKED' });
  });
  it('can require every guest to be ready', async () => {
    const t = boot();
    const made = await t.svc.create('host', { ...body, requireReady: true });
    if (!made.ok) throw new Error('create');
    await t.svc.join('guest', made.table.code);
    expect(await t.svc.start('host')).toEqual({ ok: false, error: 'NOT_READY' });
    t.svc.setReady('guest', true);
    expect(await t.svc.start('host')).toEqual({ ok: true });
  });
  it('closes after the idle time, and the host leaving closes it', async () => {
    const t = boot();
    const made = await t.svc.create('host', body);
    if (!made.ok) throw new Error('create');
    t.clock.ms += 16 * 60_000;
    expect(await t.svc.get('host', made.table.code)).toBeNull();
    const again = await t.svc.create('host', body);
    if (!again.ok) throw new Error('create');
    await t.svc.join('guest', again.table.code);
    t.svc.leave('host');
    expect(await t.svc.mine('guest')).toBeNull();
  });
  it('keeps the table for a rematch and reports a failed start', async () => {
    const t = boot();
    const made = await t.svc.create('host', body);
    if (!made.ok) throw new Error('create');
    await t.svc.join('guest', made.table.code);
    t.setFail(true);
    expect(await t.svc.start('host')).toEqual({ ok: false, error: 'START_FAILED' });
    t.setFail(false);
    await t.svc.start('host');
    t.inMatch.clear();
    expect((await t.svc.start('host')).ok).toBe(true);
    expect(t.started).toHaveLength(2);
  });
});

describe('2v2 tables', () => {
  const body2 = { ...body, format: '2v2' as const };
  it('seats four, puts friends on teams, lets a player switch, and starts a team match', async () => {
    const t = boot();
    const made = await t.svc.create('host', body2);
    if (!made.ok) throw new Error('create');
    expect(made.table).toMatchObject({ format: '2v2', seats: 4 });
    const code = made.table.code;
    for (const u of ['b', 'c', 'd']) await t.svc.join(u, code);
    expect(await t.svc.join('e', code)).toEqual({ ok: false, error: 'FULL' });
    const view = await t.svc.get('host', code);
    expect(view?.players.map((p) => [p.id, p.side])).toEqual([['host', 0], ['b', 1], ['c', 0], ['d', 1]]);
    expect(view?.players.find((p) => p.isYou)?.id).toBe('host');
    expect(t.svc.setSide('c', 1)).toEqual({ ok: false, error: 'FULL' }); // team 2 already has two
    expect(t.svc.setSide('b', 0)).toEqual({ ok: false, error: 'FULL' });
    expect(t.svc.leave('d')).toEqual({ ok: true });
    expect(t.svc.setSide('c', 1)).toEqual({ ok: true });
    expect(await t.svc.start('host')).toEqual({ ok: false, error: 'NEED_PLAYERS' });
    await t.svc.join('d', code); // goes to the emptier team: host's
    expect(await t.svc.start('host')).toEqual({ ok: true });
    expect(t.teams).toEqual([[['host', 'd'], ['b', 'c']]]);
  });

  it('refuses a side switch at a 1v1 table, and 2v2 when the server cannot start teams', async () => {
    const t = boot();
    const made = await t.svc.create('host', body);
    if (!made.ok) throw new Error('create');
    expect(t.svc.setSide('host', 1)).toEqual({ ok: false, error: 'NOT_TEAM' });
    const plain = new TableService({ profileOf: async () => null, startMatch: async () => true, inMatch: () => false, idleMs: async () => 1000 });
    expect(await plain.create('h', body2)).toEqual({ ok: false, error: 'INVALID' });
  });
});
