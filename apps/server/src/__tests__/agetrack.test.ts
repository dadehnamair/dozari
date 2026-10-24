import { describe, expect, it } from 'vitest';
import type { AgeTrack } from '@dozari/shared';
import { AgeTrackService } from '../agetrack/service.js';
import type { AgeTrackStore, TrackRecord } from '../agetrack/service.js';

function memoryStore(): AgeTrackStore & { rows: Map<string, TrackRecord> } {
  const rows = new Map<string, TrackRecord>();
  return {
    rows,
    get: async (id) => rows.get(id) ?? { track: 'adult', setAt: null },
    getMany: async (ids) => new Map(ids.map((i) => [i, rows.get(i)?.track ?? 'adult'] as [string, AgeTrack])),
    save: async (id, track, at) => void rows.set(id, { track, setAt: at }),
  };
}

describe('AgeTrackService', () => {
  it('reads as adult and chosen when the feature is off, and refuses a pick', async () => {
    const svc = new AgeTrackService(memoryStore(), async () => false);
    expect(await svc.mine('u')).toMatchObject({ enabled: false, track: 'adult', chosen: true });
    expect(await svc.choose('u', 'kid')).toEqual({ ok: false, error: 'feature_off' });
    expect(await svc.effective('u')).toBe('adult');
  });

  it('asks once, then remembers the pick', async () => {
    const store = memoryStore();
    const svc = new AgeTrackService(store, async () => true, () => new Date('2026-10-05T00:00:00Z'));
    expect(await svc.mine('u')).toMatchObject({ enabled: true, chosen: false, track: 'adult' });
    const out = await svc.choose('u', 'kid');
    expect(out.ok && out.mine).toMatchObject({ track: 'kid', chosen: true, rules: { coinWager: false, wordLesson: true } });
    expect(await svc.effective('u')).toBe('kid');
  });

  it('lets a player move younger but needs a guardian to move older once the grace window is over', async () => {
    const store = memoryStore();
    let now = new Date('2026-10-05T00:00:00Z');
    const svc = new AgeTrackService(store, async () => true, () => now);
    await svc.choose('u', 'teen');
    now = new Date('2026-10-07T00:00:00Z');
    expect(await svc.choose('u', 'kid')).toMatchObject({ ok: true });
    now = new Date('2026-10-09T00:00:00Z');
    expect(await svc.choose('u', 'teen')).toEqual({ ok: false, error: 'needs_guardian' });
    expect(await svc.choose('u', 'adult')).toEqual({ ok: false, error: 'needs_guardian' });
    expect(store.rows.get('u')?.track).toBe('kid');
  });

  it('lets a wrong pick be undone to any track within the grace window, unless a guardian is linked', async () => {
    const store = memoryStore();
    let now = new Date('2026-10-05T00:00:00Z');
    const svc = new AgeTrackService(store, async () => true, () => now);
    const mine = async () => (await svc.mine('u')).canRevert;
    expect(await mine()).toBe(false); // never asked
    await svc.choose('u', 'kid');
    expect(await mine()).toBe(true);
    expect(await svc.choose('u', 'adult')).toMatchObject({ ok: true });
    expect(await mine()).toBe(false); // adult has nothing to undo
    await svc.choose('u', 'kid');
    now = new Date('2026-10-06T01:00:00Z'); // 25 hours later
    expect(await mine()).toBe(false);
    expect(await svc.choose('u', 'adult')).toEqual({ ok: false, error: 'needs_guardian' });

    const linked = new AgeTrackService(memoryStore(), async () => true, () => now, async () => true);
    await linked.choose('c', 'kid');
    expect((await linked.mine('c')).canRevert).toBe(false);
    expect(await linked.choose('c', 'adult')).toEqual({ ok: false, error: 'needs_guardian' });
  });
});
