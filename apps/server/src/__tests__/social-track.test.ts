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

const ids = { kid1: 'k1', kid2: 'k2', teen: 't1', adult1: 'a1', adult2: 'a2' };

function setup(enabled = true) {
  const rows = new Map<string, TrackRecord>();
  const tracks: AgeTrackStore = {
    get: async (id) => rows.get(id) ?? { track: 'adult', setAt: null },
    getMany: async (list) => new Map(list.map((i) => [i, rows.get(i)?.track ?? 'adult'] as [string, AgeTrack])),
    save: async (id, track, at) => void rows.set(id, { track, setAt: at }),
  };
  const svc = new AgeTrackService(tracks, async () => enabled);
  for (const [id, track] of [[ids.kid1, 'kid'], [ids.kid2, 'kid'], [ids.teen, 'teen']] as const) rows.set(id, { track, setAt: new Date() });
  const seed = Object.values(ids).map((id) => ({ id, nickname: `n-${id}`, avatarKey: 'a', createdAt: 0, coins: 0 }));
  const socialStore = createMemorySocialStore(seed);
  const social = new SocialService(socialStore);
  social.sameTrack = (me, others) => svc.meetable(me, others);
  const findStore = createMemoryFindStore();
  const find = new FindService(findStore, socialStore, async () => ({ inviteBase: 'x/', shortenerUrl: '', autoFriendHours: 24, autoFriendPerDay: 20 }), createShortener({ resolve: async () => ['93.184.216.34'] }), mulberry32(1), () => 0, (me, others) => svc.meetable(me, others));
  return { rows, svc, social, find };
}

describe('track-bound friends (age-tracks phase 4)', () => {
  it('meetable keeps only the same track, and everybody while the feature is off', async () => {
    const { svc } = setup();
    expect([...(await svc.meetable(ids.kid1, [ids.kid2, ids.teen, ids.adult1]))]).toEqual([ids.kid2]);
    expect([...(await svc.meetable(ids.adult1, [ids.adult2, ids.kid1]))]).toEqual([ids.adult2]);
    const off = setup(false);
    expect((await off.svc.meetable(ids.kid1, [ids.teen, ids.adult1])).size).toBe(2);
  });

  it('hides players of another track: profile and friend request read as unknown', async () => {
    const { social } = setup();
    expect(await social.profile(ids.kid1, ids.adult1)).toBeNull();
    expect(await social.profile(ids.adult1, ids.kid1)).toBeNull();
    expect(await social.profile(ids.kid1, ids.kid2)).not.toBeNull();
    expect(await social.request(ids.kid1, ids.adult1)).toBe('unknown_player');
    expect(await social.request(ids.kid1, ids.kid2)).toBe('ok');
    expect(await social.accept(ids.kid2, ids.kid1)).toBe(true);
  });

  it('does not show or accept a friendship that crossed tracks after a move', async () => {
    const { social, rows } = setup();
    await social.request(ids.kid1, ids.kid2);
    await social.accept(ids.kid2, ids.kid1);
    expect((await social.friends(ids.kid1)).friends.map((f) => f.id)).toEqual([ids.kid2]);
    rows.set(ids.kid2, { track: 'teen', setAt: new Date() });
    expect((await social.friends(ids.kid1)).friends).toEqual([]);
    await social.request(ids.kid1, ids.teen); // pending request across tracks is refused as well
    expect((await social.friends(ids.teen)).incoming).toEqual([]);
  });

  it('search, contacts and invite links never reach another track', async () => {
    const { find } = setup();
    const kidHandle = await find.handle(ids.kid2);
    const adultHandle = await find.handle(ids.adult1);
    expect(await find.search(ids.kid1, kidHandle)).toEqual({ player: expect.objectContaining({ id: ids.kid2 }) });
    expect(await find.search(ids.kid1, adultHandle)).toEqual({ player: null });
    expect(await find.search(ids.adult2, kidHandle)).toEqual({ player: null });
    expect(await find.friendByLink(ids.kid1, adultHandle)).toBe('unknown');
    expect(await find.friendByLink(ids.kid1, kidHandle)).toBe('friends');
  });
});
