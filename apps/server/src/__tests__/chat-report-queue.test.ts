import { describe, expect, it } from 'vitest';
import { ChatService } from '../chat/service.js';
import { createMemoryChatStore } from '../chat/store.js';

const [K1, K2, T1, T2, A1, A2] = ['k1', 'k2', 't1', 't2', 'a1', 'a2'];

async function setup() {
  const store = createMemoryChatStore();
  store.tracks.set(K1, 'kid');
  store.tracks.set(K2, 'kid');
  store.tracks.set(T1, 'teen');
  store.tracks.set(T2, 'teen');
  const chat = new ChatService(store, {
    cityOf: async () => ({ id: 'c1', nameFa: 'شهر' }),
    profileOf: async (id) => ({ nickname: id, avatarKey: 'avatar-01' }),
    badgeTitleOf: async () => null,
    isActivated: async () => true,
    mute: async () => null,
    hasContactPerk: async () => false,
    areFriends: async () => true,
    tableMembers: () => null,
    rules: async () => ({ maxLen: 60, textNeedsActivation: false, enabled: true, globalEnabled: true }),
  });
  chat.managed = { trackOf: async (id) => store.tracks.get(id) ?? 'adult', hasGuardian: async () => true, chatMode: async () => 'friends_text' };
  const kidLine = await chat.sendDm(K1, K2, { kind: 'text', text: 'یک خط از کودک' });
  const teenLine = await chat.sendDm(T1, T2, { kind: 'text', text: 'یک خط از نوجوان' });
  const adultLine = await chat.sendCity(A1, { kind: 'text', text: 'یک خط از بزرگسال' });
  if (!kidLine.ok || !teenLine.ok || !adultLine.ok) throw new Error('send');
  await chat.report(K2, kidLine.message.id, 'مزاحمت');
  await chat.report(T2, teenLine.message.id, 'توهین');
  await chat.report(A2, adultLine.message.id, 'تبلیغ');
  return { store, chat };
}

describe('kid/teen report queue (age-tracks phase 4)', () => {
  it('splits the reports by the track of the reported player', async () => {
    const { store } = await setup();
    const all = await store.reports({ openOnly: true, limit: 10 });
    const minors = await store.reports({ openOnly: true, limit: 10, queue: 'minors' });
    const adults = await store.reports({ openOnly: true, limit: 10, queue: 'adults' });
    expect(all).toHaveLength(3);
    expect(minors.map((r) => r.track).sort()).toEqual(['kid', 'teen']);
    expect(adults.map((r) => [r.messageText, r.track])).toEqual([['یک خط از بزرگسال', 'adult']]);
  });

  it('shows the reported line only: no other message of the chat is in the queue', async () => {
    const { store, chat } = await setup();
    await chat.sendDm(K2, K1, { kind: 'text', text: 'جواب دوست' }); // never reported
    const minors = await store.reports({ openOnly: false, limit: 10, queue: 'minors' });
    expect(minors).toHaveLength(2);
    expect(JSON.stringify(minors)).not.toContain('جواب دوست');
  });
});
