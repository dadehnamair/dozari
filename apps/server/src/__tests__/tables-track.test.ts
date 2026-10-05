import { describe, expect, it } from 'vitest';
import type { AgeTrack } from '@dozari/shared';
import { TableService } from '../tables/service.js';

function boot(tracks: Record<string, AgeTrack>) {
  const started: [string, string][] = [];
  const svc = new TableService({
    profileOf: async (id) => ({ nickname: id, avatarKey: 'avatar-01' }),
    startMatch: async (a, b) => (started.push([a, b]), true),
    startTeam: async () => true,
    inMatch: () => false,
    trackOf: async (id) => tracks[id] ?? 'adult',
    idleMs: async () => 15 * 60_000,
  });
  return { svc, started, tracks };
}
const body = { name: 'میز', icon: 'dice' as const, requireReady: false, format: '1v1' as const };

describe('private tables per age track (age-tracks phase 4)', () => {
  it('a table seats one track: others find nothing and cannot join', async () => {
    const { svc } = boot({ kidHost: 'kid', kidFriend: 'kid', teen: 'teen', grown: 'adult' });
    const made = await svc.create('kidHost', body);
    if (!made.ok) throw new Error('create');
    const code = made.table.code;
    expect(await svc.get('teen', code)).toBeNull();
    expect(await svc.get('grown', code)).toBeNull();
    expect(await svc.join('teen', code)).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(await svc.join('grown', code)).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(await svc.get('kidFriend', code)).not.toBeNull();
    expect((await svc.join('kidFriend', code)).ok).toBe(true);
  });

  it('a kid duel at a table starts between two kids', async () => {
    const { svc, started } = boot({ a: 'kid', b: 'kid' });
    const made = await svc.create('a', body);
    if (!made.ok) throw new Error('create');
    await svc.join('b', made.table.code);
    expect(await svc.start('a')).toEqual({ ok: true });
    expect(started).toEqual([['a', 'b']]);
  });

  it('a guest who moved track after sitting is freed at start, never played', async () => {
    const { svc, started, tracks } = boot({ a: 'teen', b: 'teen' });
    const made = await svc.create('a', body);
    if (!made.ok) throw new Error('create');
    await svc.join('b', made.table.code);
    tracks.b = 'kid';
    expect(await svc.start('a')).toEqual({ ok: false, error: 'NEED_PLAYERS' });
    expect(started).toEqual([]);
    expect((await svc.get('a', made.table.code))?.players.map((p) => p.id)).toEqual(['a']);
  });

  it('without a track lookup everybody shares tables as before', async () => {
    const svc = new TableService({ profileOf: async () => null, startMatch: async () => true, inMatch: () => false, idleMs: async () => 60_000 });
    const made = await svc.create('x', body);
    if (!made.ok) throw new Error('create');
    expect((await svc.join('y', made.table.code)).ok).toBe(true);
  });
});
