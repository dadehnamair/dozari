import { describe, expect, it } from 'vitest';
import type { AgeTrack } from '@dozari/shared';
import { ChatService } from '../chat/service.js';
import { createMemoryChatStore } from '../chat/store.js';
import { TextFilterService, createMemoryWordStore } from '../textfilter/service.js';

const [K1, K2, A1] = ['k1', 'k2', 'a1'];

async function setup() {
  const store = createMemoryChatStore();
  const words = new TextFilterService(createMemoryWordStore());
  await words.add('ابله', 'block', 'all');
  await words.add('خنگ', 'block', 'kid_teen');
  const tracks: Record<string, AgeTrack> = { [K1]: 'kid', [K2]: 'kid', [A1]: 'adult' };
  const chat = new ChatService(store, {
    cityOf: async () => null,
    profileOf: async (id) => ({ nickname: id, avatarKey: 'avatar-01' }),
    badgeTitleOf: async () => null,
    isActivated: async () => true,
    mute: async () => null,
    hasContactPerk: async () => false,
    areFriends: async () => true,
    tableMembers: () => null,
    rules: async () => ({ maxLen: 60, textNeedsActivation: true, enabled: true, globalEnabled: true }),
    filter: words,
  });
  chat.managed = { trackOf: async (id) => tracks[id] ?? 'adult', hasGuardian: async () => true, chatMode: async () => 'friends_text' };
  const kidCat = await store.addCategory('کودکانه', null, 'kid');
  const kidTaunt = await store.addTaunt(kidCat.id, 'آفرین! 🎉');
  if (kidTaunt === 'no_category') throw new Error('category');
  const adultTaunt = (await store.taunts())[0]!.taunts[0]!;
  return { chat, store, kidTaunt, adultTaunt };
}

describe('per-track taunt library and stricter word list (age-tracks phase 4)', () => {
  it('shows each track only its own taunt categories', async () => {
    const { chat } = await setup();
    const kid = await chat.taunts(K1);
    expect(kid.map((c) => c.nameFa)).toEqual(['کودکانه']);
    const adult = await chat.taunts(A1);
    expect(adult.map((c) => c.nameFa)).not.toContain('کودکانه');
    expect((await chat.taunts()).map((c) => c.nameFa)).not.toContain('کودکانه'); // no user = the adult library
  });

  it('refuses a taunt of another track, in a private chat and in a match', async () => {
    const { chat, kidTaunt, adultTaunt } = await setup();
    expect((await chat.sendDm(K1, K2, { kind: 'taunt', tauntId: kidTaunt.id })).ok).toBe(true);
    expect(await chat.sendDm(K2, K1, { kind: 'taunt', tauntId: adultTaunt.id })).toMatchObject({ ok: false, error: 'UNKNOWN_TAUNT' });
    expect(await chat.sendMatchTaunt(A1, 'm1', 'x', kidTaunt.id)).toMatchObject({ ok: false, error: 'UNKNOWN_TAUNT' });
    expect((await chat.sendMatchTaunt('a2', 'm1', 'x', adultTaunt.id)).ok).toBe(true);
  });

  it('applies the stricter word list only to kid and teen readers', async () => {
    const { chat } = await setup();
    expect(await chat.sendDm(K1, K2, { kind: 'text', text: 'تو خنگ هستی' })).toMatchObject({ ok: false, error: 'FILTERED' });
    expect(await chat.sendDm(K1, K2, { kind: 'text', text: 'تو ابله هستی' })).toMatchObject({ ok: false, error: 'FILTERED' }); // the general list still applies
    expect(await chat.sendDm(K1, K2, { kind: 'text', text: 'سلام دوست' })).toMatchObject({ ok: true });
    const adultOnly = new TextFilterService(createMemoryWordStore());
    await adultOnly.add('خنگ', 'block', 'kid_teen');
    expect((await adultOnly.check('تو خنگ هستی', 'all')).ok).toBe(true);
    expect((await adultOnly.check('تو خنگ هستی', 'kid_teen')).ok).toBe(false);
  });
});
