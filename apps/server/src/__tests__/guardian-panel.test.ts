import { describe, expect, it } from 'vitest';
import { DEFAULT_GUARDIAN_SETTINGS } from '@dozari/shared';
import type { AgeTrack, ChildLimits, GuardianSettings } from '@dozari/shared';
import { AgeTrackService } from '../agetrack/service.js';
import type { AgeTrackStore, TrackRecord } from '../agetrack/service.js';
import { ChatService } from '../chat/service.js';
import { createMemoryChatStore } from '../chat/store.js';
import { GuardianService } from '../guardian/service.js';
import type { GuardianStore } from '../guardian/service.js';
import { GuardianSettingsService, createMemoryGuardianSettingsStore } from '../guardian/settings.js';
import { SocialService } from '../social/service.js';
import { createMemorySocialStore } from '../social/store.js';
import { TableService } from '../tables/service.js';

const [G, K1, K2, OTHER_GUARDIAN] = ['g1', 'k1', 'k2', 'g2'];

function setup() {
  const rows = new Map<string, TrackRecord>([[K1, { track: 'kid', setAt: new Date() }], [K2, { track: 'kid', setAt: new Date() }]]);
  const links = new Map([[K1, G], [K2, G]]);
  const store: AgeTrackStore = {
    get: async (id) => rows.get(id) ?? { track: 'adult', setAt: null },
    getMany: async (ids) => new Map(ids.map((i) => [i, rows.get(i)?.track ?? 'adult'] as [string, AgeTrack])),
    save: async () => {},
  };
  const settings = new GuardianSettingsService(createMemoryGuardianSettingsStore(), () => 0); // the clock never moves, so the cache never expires: save drops it
  const hasGuardian = async (id: string) => links.has(id);
  const tracks = new AgeTrackService(store, async () => true, () => new Date(), hasGuardian, async (id): Promise<ChildLimits | null> => ((await hasGuardian(id)) ? settings.limits(id) : null));
  const guardian = new GuardianService({ isChildOf: async (g: string, c: string) => links.get(c) === g } as unknown as GuardianStore, store, {} as never, {} as never, {} as never, () => 'd');
  guardian.settings = settings;
  const seed = [G, K1, K2].map((id) => ({ id, nickname: id, avatarKey: 'a', createdAt: 0, coins: 0 }));
  const socialStore = createMemorySocialStore(seed);
  const social = new SocialService(socialStore);
  social.blocked = (id) => tracks.socialBlocked(id);
  social.asksGuardian = (id) => tracks.friendsNeedApproval(id);
  social.sameTrack = (me, others) => tracks.meetable(me, others);
  guardian.friends = { friends: (id) => socialStore.friends(id), incoming: (id) => socialStore.incoming(id), approve: (c, o) => social.approveFor(c, o), remove: (c, o) => social.remove(c, o) };
  const chat = new ChatService(createMemoryChatStore(), {
    cityOf: async () => null,
    profileOf: async (id) => ({ nickname: id, avatarKey: 'avatar-01' }),
    badgeTitleOf: async () => null,
    isActivated: async () => true,
    mute: async () => null,
    hasContactPerk: async () => false,
    areFriends: async () => true,
    tableMembers: (id) => [K1, K2, id].filter((v, i, a) => a.indexOf(v) === i),
    rules: async () => ({ maxLen: 60, textNeedsActivation: false, enabled: true, globalEnabled: true }),
  });
  chat.managed = { trackOf: (id) => tracks.effective(id), hasGuardian, chatMode: async (id) => (await settings.get(id)).chatMode };
  const table = new TableService({ profileOf: async () => null, startMatch: async () => true, inMatch: () => false, trackOf: (id) => tracks.effective(id), socialBlocked: (id) => tracks.socialBlocked(id), duelsOff: (id) => tracks.duelsOff(id), idleMs: async () => 60_000 });
  const put = (patch: Partial<GuardianSettings>) => guardian.putSettings(G, K1, { ...DEFAULT_GUARDIAN_SETTINGS, ...patch });
  return { guardian, tracks, chat, table, social, put, settings };
}

const tableBody = { name: 'میز', icon: 'dice' as const, requireReady: false, format: '1v1' as const };

describe('guardian panel (age-tracks phase 5)', () => {
  it('only the child’s own guardian reads or changes the settings, and the defaults are the open ones', async () => {
    const { guardian } = setup();
    expect(await guardian.getSettings(G, K1)).toEqual({ ok: true, settings: DEFAULT_GUARDIAN_SETTINGS });
    expect(await guardian.getSettings(OTHER_GUARDIAN, K1)).toMatchObject({ ok: false, error: 'not_found' });
    expect(await guardian.putSettings(OTHER_GUARDIAN, K1, { ...DEFAULT_GUARDIAN_SETTINGS, chatMode: 'off' })).toMatchObject({ ok: false, error: 'not_found' });
    await guardian.putSettings(G, K1, { ...DEFAULT_GUARDIAN_SETTINGS, chatMode: 'phrases', reminderMinutes: 30 });
    expect(await guardian.getSettings(G, K1)).toMatchObject({ settings: { chatMode: 'phrases', reminderMinutes: 30 } });
  });

  it('shows the child’s own app only its limits, and nothing to an adult', async () => {
    const { tracks, put } = setup();
    await put({ duelsEnabled: false, quietFrom: 1320, quietTo: 420 });
    expect((await tracks.mine(K1)).limits).toMatchObject({ duelsEnabled: false, quietFrom: 1320, quietTo: 420, chatMode: 'friends_text' });
    expect((await tracks.mine(G)).limits).toBeNull();
  });

  it('chat mode: phrases only blocks free text, off blocks phrases and the history too', async () => {
    const { chat, put } = setup();
    expect((await chat.sendDm(K1, K2, { kind: 'text', text: 'سلام' })).ok).toBe(true);
    await put({ chatMode: 'phrases' });
    expect(await chat.sendDm(K1, K2, { kind: 'text', text: 'سلام دوباره' })).toMatchObject({ ok: false, error: 'PHRASES_ONLY' });
    const h = await chat.dmHistory(K1, K2);
    expect(typeof h === 'object' && h.canType).toBe(false);
    await put({ chatMode: 'off' });
    expect(await chat.sendDm(K1, K2, { kind: 'text', text: 'سلام' })).toMatchObject({ ok: false, error: 'OFF' });
    expect(await chat.dmHistory(K1, K2)).toBe('OFF');
    expect((await chat.sendDm(K2, K1, { kind: 'text', text: 'از طرف دیگر' })).ok).toBe(true); // K2 has no limits of its own
  });

  it('duels off: the child can neither open nor join a table', async () => {
    const { table, put } = setup();
    await put({ duelsEnabled: false });
    expect(await table.create(K1, tableBody)).toEqual({ ok: false, error: 'FEATURE_OFF' });
    const made = await table.create(K2, tableBody);
    if (!made.ok) throw new Error('create');
    expect(await table.join(K1, made.table.code)).toEqual({ ok: false, error: 'FEATURE_OFF' });
  });

  it('ask first: the child neither sends nor accepts, and the guardian approves what is waiting', async () => {
    const { guardian, social, put } = setup();
    await put({ friendApproval: 'ask' });
    expect(await social.request(K1, K2)).toBe('ask_guardian');
    expect(await social.request(K2, K1)).toBe('ok'); // the other child (auto) asks K1
    expect(await social.accept(K1, K2)).toBe('ask_guardian');
    const seen = await guardian.friendsOf(G, K1);
    expect(seen.ok && seen.requests.map((r) => r.id)).toEqual([K2]);
    expect(await guardian.approveFriend(OTHER_GUARDIAN, K1, K2)).toMatchObject({ ok: false });
    expect(await guardian.approveFriend(G, K1, K2)).toEqual({ ok: true });
    const after = await guardian.friendsOf(G, K1);
    expect(after.ok && after.friends.map((f) => f.id)).toEqual([K2]);
    expect(await guardian.removeFriend(G, K1, K2)).toEqual({ ok: true });
    expect((await guardian.friendsOf(G, K1)).ok && (await guardian.friendsOf(G, K1))).toMatchObject({ friends: [] });
  });
});

describe('audit of band changes and guardian actions', () => {
  it('records the child’s band choice and the guardian’s settings change', async () => {
    const { tracks, guardian } = setup();
    const rows: string[] = [];
    tracks.audit = (action, target, detail) => void rows.push(`${action} ${target} ${detail ?? ''}`);
    guardian.audit = (action, target, detail) => void rows.push(`${action} ${target} ${detail ?? ''}`);
    await tracks.choose('fresh', 'teen');
    await guardian.putSettings(G, K1, { ...DEFAULT_GUARDIAN_SETTINGS, chatMode: 'off' });
    expect(rows[0]).toBe('age_track.choose fresh first->teen');
    expect(rows[1]).toContain('guardian.settings k1');
    expect(rows[1]).toContain('chat=off');
  });
});
