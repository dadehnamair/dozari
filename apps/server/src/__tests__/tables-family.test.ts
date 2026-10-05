import { describe, expect, it } from 'vitest';
import type { AgeTrack } from '@dozari/shared';
import { TableService } from '../tables/service.js';

// g = guardian (adult) of k1 (kid), t1 and t2 (teens); other = an unrelated adult; stranger = an unrelated kid.
const guardianOf: Record<string, string> = { k1: 'g', t1: 'g', t2: 'g' };
const tracks: Record<string, AgeTrack> = { g: 'adult', other: 'adult', k1: 'kid', t1: 'teen', t2: 'teen', stranger: 'kid' };

function boot() {
  const started: string[][] = [];
  const teams: string[][][] = [];
  const svc = new TableService({
    profileOf: async () => null,
    startMatch: async (a, b) => (started.push([a, b]), true),
    startTeam: async (sides) => (teams.push(sides.map((x) => [...x])), true),
    inMatch: () => false,
    trackOf: async (id) => tracks[id] ?? 'adult',
    socialBlocked: async () => false,
    duelsOff: async (id) => id === 'k1', // the guardian switched duels off for k1
    hasFamily: async (id) => id === 'g' || id in guardianOf,
    sameFamily: async (a, b) => guardianOf[a] === b || guardianOf[b] === a || (guardianOf[a] !== undefined && guardianOf[a] === guardianOf[b]),
    idleMs: async () => 60_000,
  });
  return { svc, started, teams };
}
const body = { name: 'میز', icon: 'dice' as const, requireReady: false, format: '1v1' as const, family: true };

describe('family table (age-tracks phase 5)', () => {
  it('a guardian and their child sit together across tracks, and the youngest is the first player', async () => {
    const { svc, started } = boot();
    const made = await svc.create('g', body);
    if (!made.ok) throw new Error('create');
    expect(made.table.family).toBe(true);
    expect((await svc.join('t1', made.table.code)).ok).toBe(true);
    expect(await svc.start('g')).toEqual({ ok: true });
    expect(started).toEqual([['t1', 'g']]); // the teen first: the puzzle pool follows them
  });

  it('a child may host a family table and the guardian joins it', async () => {
    const { svc } = boot();
    const made = await svc.create('t1', body);
    if (!made.ok) throw new Error('create');
    expect((await svc.join('g', made.table.code)).ok).toBe(true);
  });

  it('is closed to everybody else: another adult, a stranger kid, and a child of another family', async () => {
    const { svc } = boot();
    const made = await svc.create('g', body);
    if (!made.ok) throw new Error('create');
    for (const who of ['other', 'stranger']) {
      expect(await svc.join(who, made.table.code)).toEqual({ ok: false, error: 'NOT_FOUND' });
      expect(await svc.get(who, made.table.code)).toBeNull();
    }
  });

  it('is only for people who have a family, and a normal table stays same-track', async () => {
    const { svc } = boot();
    expect(await svc.create('other', body)).toEqual({ ok: false, error: 'INVALID' });
    const plain = await svc.create('g', { ...body, family: false });
    if (!plain.ok) throw new Error('create');
    expect(await svc.join('t1', plain.table.code)).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('the guardian’s duel switch does not block a family table the guardian sits at', async () => {
    const { svc } = boot();
    expect(await svc.create('k1', { ...body, family: false })).toEqual({ ok: false, error: 'FEATURE_OFF' });
    const made = await svc.create('g', body);
    if (!made.ok) throw new Error('create');
    expect((await svc.join('k1', made.table.code)).ok).toBe(true);
  });

  it('a 2v2 family table puts the youngest first', async () => {
    const { svc, teams } = boot();
    const made = await svc.create('g', { ...body, format: '2v2' });
    if (!made.ok) throw new Error('create');
    for (const who of ['t1', 'k1', 't2']) expect((await svc.join(who, made.table.code)).ok).toBe(true);
    expect(await svc.start('g')).toEqual({ ok: true });
    expect(teams[0]![0]![0]).toBe('k1'); // the kid leads the first side
  });
});
