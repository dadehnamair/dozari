import { describe, expect, it } from 'vitest';
import { PLAY_HEARTBEAT_MIN_GAP_MS, PLAY_MINUTES_DAY_CAP } from '@dozari/shared';
import { AgeTrackService } from '../agetrack/service.js';
import type { AgeTrackStore, TrackRecord } from '../agetrack/service.js';
import { GuardianService } from '../guardian/service.js';
import type { GuardianStore } from '../guardian/service.js';
import { PlayTimeService, createMemoryGuardianBlockStore, createMemoryPlayTimeStore } from '../guardian/extras.js';
import { SocialService } from '../social/service.js';
import { createMemorySocialStore } from '../social/store.js';
import type { AgeTrack } from '@dozari/shared';

const [G, K1, K2] = ['g1', 'k1', 'k2'];

function setup() {
  const rows = new Map<string, TrackRecord>([[K1, { track: 'kid', setAt: new Date() }], [K2, { track: 'kid', setAt: new Date() }]]);
  const store: AgeTrackStore = {
    get: async (id) => rows.get(id) ?? { track: 'adult', setAt: null },
    getMany: async (ids) => new Map(ids.map((i) => [i, rows.get(i)?.track ?? 'adult'] as [string, AgeTrack])),
    save: async () => {},
  };
  const ages = new AgeTrackService(store, async () => true, () => new Date(), async () => true);
  const blocks = createMemoryGuardianBlockStore({ [K2]: 'دوست' });
  const socialStore = createMemorySocialStore([G, K1, K2].map((id) => ({ id, nickname: id, avatarKey: 'a', createdAt: 0, coins: 0 })));
  const social = new SocialService(socialStore);
  social.sameTrack = async (me, others) => {
    const ok = await ages.meetable(me, others);
    for (const id of [...ok]) if (await blocks.between(me, id)) ok.delete(id);
    return ok;
  };
  const guardian = new GuardianService({ isChildOf: async (g: string, c: string) => g === G && (c === K1 || c === K2) } as unknown as GuardianStore, store, {} as never, {} as never, {} as never, () => 'd');
  guardian.blocks = blocks;
  guardian.friends = { friends: (id) => socialStore.friends(id), incoming: (id) => socialStore.incoming(id), approve: (c, o) => social.approveFor(c, o), remove: (c, o) => social.remove(c, o) };
  return { guardian, social, blocks };
}

describe('guardian blocks a friend (age-tracks phase 5)', () => {
  it('removes the friendship and hides both players from each other until unblocked', async () => {
    const { guardian, social } = setup();
    await social.request(K1, K2);
    await social.accept(K2, K1);
    expect((await social.friends(K1)).friends.map((f) => f.id)).toEqual([K2]);
    expect(await guardian.block(G, K1, K2)).toEqual({ ok: true });
    expect((await social.friends(K1)).friends).toEqual([]);
    expect(await social.profile(K1, K2)).toBeNull();
    expect(await social.profile(K2, K1)).toBeNull(); // the block hides the child from the other side too
    expect(await social.request(K2, K1)).toBe('unknown_player');
    expect(await guardian.listBlocks(G, K1)).toMatchObject({ ok: true, blocked: [{ id: K2, nickname: 'دوست' }] });
    expect(await guardian.unblock(G, K1, K2)).toEqual({ ok: true });
    expect(await social.request(K2, K1)).toBe('ok');
  });

  it('only the child’s own guardian may block, and nobody blocks themselves or the guardian', async () => {
    const { guardian } = setup();
    expect(await guardian.block('stranger', K1, K2)).toMatchObject({ ok: false, error: 'not_found' });
    expect(await guardian.block(G, K1, K1)).toMatchObject({ ok: false, error: 'self' });
    expect(await guardian.block(G, K1, G)).toMatchObject({ ok: false, error: 'self' });
    expect(await guardian.unblock(G, K1, K2)).toMatchObject({ ok: false, error: 'not_found' }); // nothing to unblock
  });
});

describe('play-time heartbeat', () => {
  function clock() {
    const c = { ms: Date.UTC(2026, 9, 5, 9, 0, 0) };
    const svc = new PlayTimeService(createMemoryPlayTimeStore(), (ms) => new Date(ms).toISOString().slice(0, 10), () => c.ms);
    return { c, svc };
  }

  it('counts one minute per heartbeat and ignores one that comes too soon', async () => {
    const { c, svc } = clock();
    expect(await svc.beat('k1')).toEqual({ today: 1, counted: true });
    c.ms += 5_000;
    expect(await svc.beat('k1')).toEqual({ today: 1, counted: false }); // a flood of beats adds nothing
    c.ms += PLAY_HEARTBEAT_MIN_GAP_MS;
    expect(await svc.beat('k1')).toEqual({ today: 2, counted: true });
    expect(await svc.today('k1')).toBe(2);
  });

  it('keeps each day apart and sums a week', async () => {
    const { c, svc } = clock();
    await svc.beat('k1');
    c.ms += 86_400_000;
    await svc.beat('k1');
    c.ms += PLAY_HEARTBEAT_MIN_GAP_MS;
    await svc.beat('k1');
    expect(await svc.today('k1')).toBe(2);
    expect(await svc.week('k1')).toBe(3);
    expect(await svc.week('k2')).toBe(0);
  });

  it('never counts more than a day has minutes', async () => {
    const store = createMemoryPlayTimeStore();
    await store.add('k1', '2026-10-05', PLAY_MINUTES_DAY_CAP - 1);
    expect(await store.add('k1', '2026-10-05', 5)).toBe(PLAY_MINUTES_DAY_CAP);
  });
});
