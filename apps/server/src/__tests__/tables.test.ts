import { describe, expect, it } from 'vitest';
import { TableService } from '../tables/service.js';

function boot() {
  const clock = { ms: 1_000_000 };
  const inMatch = new Set<string>();
  const started: [string, string][] = [];
  let fail = false;
  const svc = new TableService({
    profileOf: async (id) => ({ nickname: `p-${id}`, avatarKey: 'avatar-01' }),
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
  return { svc, clock, inMatch, started, setFail: (v: boolean) => (fail = v) };
}
const body = { name: 'میز علی', emoji: '🎲', requireReady: false };

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
