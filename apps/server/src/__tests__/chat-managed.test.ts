import { describe, expect, it } from 'vitest';
import type { AgeTrack, ChatMode } from '@dozari/shared';
import { ChatService } from '../chat/service.js';
import { createMemoryChatStore } from '../chat/store.js';

const [K1, K2, T1, A1] = ['k1', 'k2', 't1', 'a1'];

function setup(over: { guardians?: string[]; tracks?: Record<string, AgeTrack>; perk?: boolean } = {}) {
  const tracks: Record<string, AgeTrack> = over.tracks ?? { [K1]: 'kid', [K2]: 'kid', [T1]: 'teen', [A1]: 'adult' };
  const guardians = new Set(over.guardians ?? [K1, K2]);
  const modes = new Map<string, ChatMode>();
  const chat = new ChatService(createMemoryChatStore(), {
    cityOf: async () => ({ id: 'c1', nameFa: 'شهر' }),
    profileOf: async (id) => ({ nickname: id, avatarKey: 'avatar-01' }),
    badgeTitleOf: async () => null,
    isActivated: async () => false, // nobody redeemed an invite code: a guardian link must be what opens text
    mute: async () => null,
    hasContactPerk: async () => over.perk ?? false,
    areFriends: async () => true,
    tableMembers: (id) => [K1, K2, id].filter((v, i, a) => a.indexOf(v) === i),
    rules: async () => ({ maxLen: 40, textNeedsActivation: true, enabled: true, globalEnabled: true }),
  });
  chat.managed = { trackOf: async (id) => tracks[id] ?? 'adult', hasGuardian: async (id) => guardians.has(id), chatMode: async (id) => modes.get(id) ?? 'friends_text' };
  return { chat, tracks, guardians, modes };
}

describe('managed chat for kid and teen (age-tracks phase 4)', () => {
  it('closes the public rooms for a kid and a teen, leaves them open for an adult', async () => {
    const { chat } = setup();
    expect(await chat.history(K1, 'city')).toBe('OFF');
    expect(await chat.history(T1, 'global')).toBe('OFF');
    expect(await chat.sendCity(K1, { kind: 'text', text: 'سلام' })).toMatchObject({ ok: false, error: 'OFF' });
    expect(await chat.sendGlobal(T1, { kind: 'text', text: 'سلام' })).toMatchObject({ ok: false, error: 'OFF' });
    expect(await chat.sendCity(K1, { kind: 'table', code: 'ABCD2', label: 'x' })).toMatchObject({ ok: false, error: 'OFF' });
    expect(await chat.roomFor(K1)).toBeNull();
    expect(await chat.globalOpen(K1)).toBe(false);
    expect(await chat.roomFor(A1)).toBe('city:c1');
    expect(await chat.globalOpen(A1)).toBe(true);
  });

  it('lets a kid write free text to a same-track friend once a guardian is linked, no invite code needed', async () => {
    const { chat } = setup();
    expect((await chat.sendDm(K1, K2, { kind: 'text', text: 'سلام دوست' })).ok).toBe(true);
    const h = await chat.dmHistory(K2, K1);
    expect(typeof h === 'object' && h.canType).toBe(true);
  });

  it('asks for a guardian when none is linked, and shows no composer', async () => {
    const { chat } = setup({ guardians: [] });
    expect(await chat.sendDm(K1, K2, { kind: 'text', text: 'سلام' })).toMatchObject({ ok: false, error: 'NEEDS_GUARDIAN' });
    const h = await chat.dmHistory(K1, K2);
    expect(typeof h === 'object' && h.canType).toBe(false);
    // phrases still work with no guardian
  });

  it('keeps kid and teen text to private chats: a table or a match allows phrases only', async () => {
    const { chat } = setup();
    expect(await chat.sendTable(K1, 'ABCD2', { kind: 'text', text: 'سلام' })).toMatchObject({ ok: false, error: 'PHRASES_ONLY' });
    const h = await chat.tableHistory(K1, 'ABCD2');
    expect(typeof h === 'object' && h.canType).toBe(false);
  });

  it('never lets a private chat cross tracks, even between old friends', async () => {
    const { chat } = setup();
    expect(await chat.sendDm(K1, T1, { kind: 'text', text: 'سلام' })).toMatchObject({ ok: false, error: 'NOT_FRIENDS' });
    expect(await chat.sendDm(A1, K1, { kind: 'text', text: 'سلام' })).toMatchObject({ ok: false, error: 'NOT_FRIENDS' });
    expect(await chat.dmHistory(K1, A1)).toBe('NOT_FRIENDS');
  });

  it('blocks numbers and links for a kid even with a contact perk', async () => {
    const { chat } = setup({ perk: true });
    expect(await chat.sendDm(K1, K2, { kind: 'text', text: 'زنگ بزن ۰۹۱۲۳۴۵۶۷۸۹' })).toMatchObject({ ok: false, error: 'CONTACT_BLOCKED' });
  });

  it('changes nothing for an adult: the invite-code rule and the contact perk stay', async () => {
    const { chat } = setup({ perk: true, tracks: { [A1]: 'adult', a2: 'adult' } });
    expect(await chat.sendDm(A1, 'a2', { kind: 'text', text: 'سلام' })).toMatchObject({ ok: false, error: 'NEEDS_ACTIVATION' });
  });
});
