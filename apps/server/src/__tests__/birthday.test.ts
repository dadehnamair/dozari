import { describe, expect, it } from 'vitest';
import { jalaliToGregorian } from '@dozari/shared';
import { BirthdayService } from '../profile/birthday.js';
import { createMemoryBirthdayStore } from '../profile/birthday-store.js';

/** Noon (Tehran) of a Solar Hijri day. */
const at = (year: number, month: number, day: number): number => {
  const g = jalaliToGregorian(year, month, day);
  return Date.UTC(g.year, g.month - 1, g.day, 8, 30);
};

function boot(now: { ms: number }, rules = { minAge: 10, before: 3, length: 7, coins: 100, gems: 5, spins: 2 }) {
  const store = createMemoryBirthdayStore();
  const told: { to: string[]; title: string; body: string }[] = [];
  const spins: { id: string; ref: string; n: number }[] = [];
  const friends = new Map<string, string[]>([['a', ['f1', 'f2']]]);
  const service = new BirthdayService({
    store,
    rules: async () => rules,
    friendsOf: async (id) => friends.get(id) ?? [],
    giveSpins: async (id, ref, n) => (spins.push({ id, ref, n }), n),
    tell: async (to, title, body) => void told.push({ to: [...to], title, body }),
    texts: { weekTitle: 'W', weekBody: (n, d) => `${n} in ${d}`, dayTitle: 'D', dayBody: (n) => `${n} today` },
    now: () => now.ms,
  });
  return { service, store, told, spins };
}

describe('birth date', () => {
  it('saves a real date of someone at least 10, refuses the rest, and clears with null', async () => {
    const now = { ms: at(1405, 7, 11) };
    const t = boot(now);
    expect(await t.service.save('a', { birth: { year: 1395, month: 7, day: 12 }, showAge: true, notifyFriends: true })).toBe('invalid');
    expect(await t.service.save('a', { birth: { year: 1380, month: 7, day: 31 }, showAge: true, notifyFriends: true })).toBe('invalid');
    expect(await t.service.save('a', { birth: { year: 1395, month: 7, day: 11 }, showAge: true, notifyFriends: true })).toBe('ok');
    expect(await t.service.mine('a')).toMatchObject({ birth: { year: 1395, month: 7, day: 11 }, age: 10, showAge: true, isToday: true });
    await t.service.save('a', { birth: null, showAge: true, notifyFriends: false });
    expect(await t.service.mine('a')).toMatchObject({ birth: null, age: null, showAge: false, notifyFriends: false, inWeek: false });
  });

  it('shows others the party badge always and the age only when ticked, never the date', async () => {
    const now = { ms: at(1405, 7, 11) };
    const t = boot(now);
    await t.service.save('shy', { birth: { year: 1380, month: 7, day: 12 }, showAge: false, notifyFriends: true });
    await t.service.save('open', { birth: { year: 1380, month: 7, day: 11 }, showAge: true, notifyFriends: true });
    await t.service.save('far', { birth: { year: 1380, month: 1, day: 1 }, showAge: true, notifyFriends: true });
    const info = await t.service.info(['shy', 'open', 'far', 'nobody']);
    expect(info.get('shy')).toEqual({ badge: true, age: null });
    expect(info.get('open')).toEqual({ badge: true, age: 25 });
    expect(info.get('far')).toEqual({ badge: false, age: 25 });
    expect(info.has('nobody')).toBe(false);
  });
});

describe('birthday gift', () => {
  it('is claimable once per year, only in the week, and gives coins, gems and spins', async () => {
    const now = { ms: at(1405, 7, 5) };
    const t = boot(now);
    await t.service.save('a', { birth: { year: 1380, month: 7, day: 11 }, showAge: false, notifyFriends: true });
    expect((await t.service.mine('a')).gift).toMatchObject({ claimable: false, claimed: false });
    expect(await t.service.claim('a')).toEqual({ ok: false, error: 'not_in_week' });
    now.ms = at(1405, 7, 9);
    expect((await t.service.mine('a')).gift).toMatchObject({ claimable: true, coins: 100, gems: 5, spins: 2 });
    expect(await t.service.claim('a')).toMatchObject({ ok: true, claim: { coins: 100, gems: 5, spins: 2, balance: 100 } });
    expect(await t.service.claim('a')).toEqual({ ok: false, error: 'already_claimed' });
    expect(t.store.gems.get('a')).toBe(5);
    expect(t.spins).toEqual([{ id: 'a', ref: 'birthday-1405', n: 2 }]);
    expect((await t.service.mine('a')).gift).toMatchObject({ claimable: false, claimed: true });
    now.ms = at(1406, 7, 11);
    expect((await t.service.mine('a')).gift.claimable).toBe(true);
  });
  it('says so when there is no birth date or no gift is set', async () => {
    const now = { ms: at(1405, 7, 11) };
    const t = boot(now, { minAge: 10, before: 3, length: 7, coins: 0, gems: 0, spins: 0 });
    expect(await t.service.claim('a')).toEqual({ ok: false, error: 'no_birth_date' });
    await t.service.save('a', { birth: { year: 1380, month: 7, day: 11 }, showAge: false, notifyFriends: true });
    expect(await t.service.claim('a')).toEqual({ ok: false, error: 'no_gift' });
  });
});

describe('friend messages', () => {
  it('tells friends once when the week starts and once on the day, only if the player allows it', async () => {
    const now = { ms: at(1405, 7, 8) };
    const t = boot(now);
    t.store.users.set('a', { birth: { year: 1380, month: 7, day: 11 }, showAge: true, notifyFriends: true, nickname: 'علی' });
    expect(await t.service.announce()).toBe(1);
    expect(t.told).toEqual([{ to: ['f1', 'f2'], title: 'W', body: 'علی in 3' }]);
    expect(await t.service.announce()).toBe(0);
    now.ms = at(1405, 7, 11);
    expect(await t.service.announce()).toBe(1);
    expect(t.told[1]).toEqual({ to: ['f1', 'f2'], title: 'D', body: 'علی today' });
    expect(t.told.every((m) => !/\d{2}/.test(m.body.replace(/in \d/, '')))).toBe(true);
    t.store.users.set('a', { birth: { year: 1380, month: 7, day: 11 }, showAge: true, notifyFriends: false, nickname: 'علی' });
    now.ms = at(1406, 7, 8);
    expect(await t.service.announce()).toBe(0);
  });
  it('stays quiet for a player with no friends, and a 30 Esfand birthday is celebrated on the 29th when there is no 30th', async () => {
    const now = { ms: at(1404, 12, 29) };
    const t = boot(now);
    t.store.users.set('a', { birth: { year: 1403, month: 12, day: 30 }, showAge: false, notifyFriends: true, nickname: 'مینا' });
    expect(await t.service.announce()).toBe(1);
    expect(t.told[0]).toMatchObject({ title: 'D' });
  });
});
