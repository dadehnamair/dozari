import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@dozari/shared';
import type { AgeTrack } from '@dozari/shared';
import { AgeTrackService } from '../agetrack/service.js';
import type { AgeTrackStore, TrackRecord } from '../agetrack/service.js';
import { FindService } from '../find/service.js';
import { createShortener } from '../find/shortener.js';
import { createMemoryFindStore } from '../find/store.js';
import { SocialService } from '../social/service.js';
import { createMemorySocialStore } from '../social/store.js';
import { TableService } from '../tables/service.js';

function setup(enabled = true) {
  const rows = new Map<string, TrackRecord>([['kid', { track: 'kid', setAt: new Date() }], ['kid2', { track: 'kid', setAt: new Date() }], ['teen', { track: 'teen', setAt: new Date() }]]);
  const guardians = new Set<string>();
  const store: AgeTrackStore = {
    get: async (id) => rows.get(id) ?? { track: 'adult', setAt: null },
    getMany: async (ids) => new Map(ids.map((i) => [i, rows.get(i)?.track ?? 'adult'] as [string, AgeTrack])),
    save: async () => {},
  };
  const tracks = new AgeTrackService(store, async () => enabled, () => new Date(), async (id) => guardians.has(id));
  const seed = ['kid', 'kid2', 'teen', 'adult'].map((id) => ({ id, nickname: id, avatarKey: 'a', createdAt: 0, coins: 0 }));
  const socialStore = createMemorySocialStore(seed);
  const social = new SocialService(socialStore);
  social.blocked = (id) => tracks.socialBlocked(id);
  const find = new FindService(createMemoryFindStore(), socialStore, async () => ({ inviteBase: 'x/', shortenerUrl: '', autoFriendHours: 24, autoFriendPerDay: 20 }), createShortener({ resolve: async () => ['93.184.216.34'] }), mulberry32(1), () => 0, undefined, (id) => tracks.socialBlocked(id));
  const table = new TableService({ profileOf: async () => null, startMatch: async () => true, inMatch: () => false, socialBlocked: (id) => tracks.socialBlocked(id), idleMs: async () => 60_000 });
  return { tracks, guardians, social, find, table };
}

describe('social features need a linked guardian for kid and teen (age-tracks phase 4)', () => {
  it('blocks a kid and a teen with no guardian, never an adult, never while the feature is off', async () => {
    const { tracks, guardians } = setup();
    expect(await tracks.socialBlocked('kid')).toBe(true);
    expect(await tracks.socialBlocked('teen')).toBe(true);
    expect(await tracks.socialBlocked('adult')).toBe(false);
    guardians.add('kid');
    expect(await tracks.socialBlocked('kid')).toBe(false);
    expect(await setup(false).tracks.socialBlocked('kid')).toBe(false);
  });

  it('refuses friend requests and accepts until the guardian is linked, then lets them through', async () => {
    const { social, guardians } = setup();
    expect(await social.request('kid', 'kid2')).toBe('needs_guardian');
    guardians.add('kid');
    expect(await social.request('kid', 'kid2')).toBe('ok');
    expect(await social.accept('kid2', 'kid')).toBe('needs_guardian'); // the other child has no guardian yet
    guardians.add('kid2');
    expect(await social.accept('kid2', 'kid')).toBe(true); // no guardian approval step: the other child's yes is enough
  });

  it('refuses an invite link and a table (open and join) until a guardian is linked', async () => {
    const { find, table, guardians } = setup();
    const handle = await find.handle('kid2');
    expect(await find.friendByLink('kid', handle)).toBe('needs_guardian');
    const body = { name: 'میز', icon: 'dice' as const, requireReady: false, format: '1v1' as const };
    expect(await table.create('kid', body)).toEqual({ ok: false, error: 'NEEDS_GUARDIAN' });
    guardians.add('kid2');
    const made = await table.create('kid2', body);
    if (!made.ok) throw new Error('create');
    expect(await table.join('kid', made.table.code)).toEqual({ ok: false, error: 'NEEDS_GUARDIAN' });
    guardians.add('kid');
    expect((await table.join('kid', made.table.code)).ok).toBe(true);
    expect(await find.friendByLink('kid', handle)).not.toBe('needs_guardian');
  });
});
