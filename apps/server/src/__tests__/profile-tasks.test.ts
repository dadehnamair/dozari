import { describe, expect, it } from 'vitest';
import { profileTasksSchema } from '@dozari/shared';
import type { MissionKey } from '@dozari/shared';
import { ProfileTaskService } from '../profile/tasks.js';

describe('missions (D161, D163)', () => {
  const make = (facts: Partial<Record<MissionKey, boolean>>, coins: Partial<Record<MissionKey, number>> = {}) => {
    const claimed = new Set<MissionKey>();
    const paid: [MissionKey, number][] = [];
    let balance = 100;
    const svc = new ProfileTaskService({
      facts: async () => ({ gender: false, city: false, phone: false, bale: false, first_win: false, invite_friend: false, follow_instagram: true, follow_channel: true, rate_app: true, ...facts }),
      coins: async () => ({ gender: 10, city: 20, phone: 50, bale: 30, first_win: 25, invite_friend: 100, follow_instagram: 15, follow_channel: 15, rate_app: 40, ...coins }),
      claimedKeys: async () => [...claimed],
      pay: async (_u, key, c) => {
        if (claimed.has(key)) return null;
        claimed.add(key);
        paid.push([key, c]);
        balance += c;
        return { balance };
      },
    });
    return { svc, paid };
  };

  it('lists every step with what is filled in, taken and worth', async () => {
    const { svc } = make({ city: true });
    const out = profileTasksSchema.parse(await svc.list('u'));
    expect(out.tasks.map((t) => [t.key, t.done, t.claimed, t.coins])).toEqual([
      ['gender', false, false, 10], ['city', true, false, 20], ['phone', false, false, 50], ['bale', false, false, 30],
      ['first_win', false, false, 25], ['invite_friend', false, false, 100], ['follow_instagram', true, false, 15], ['follow_channel', true, false, 15], ['rate_app', true, false, 40],
    ]);
  });

  it('pays a finished step once', async () => {
    const { svc, paid } = make({ city: true });
    expect(await svc.claim('u', 'city')).toEqual({ ok: true, claim: { ok: true, key: 'city', coins: 20, balance: 120 } });
    expect(await svc.claim('u', 'city')).toEqual({ ok: false, error: 'already_claimed' });
    expect(paid).toEqual([['city', 20]]);
    expect((await svc.list('u')).tasks.find((t) => t.key === 'city')?.claimed).toBe(true);
  });

  it('refuses a step whose field is still empty', async () => {
    const { svc, paid } = make({});
    expect(await svc.claim('u', 'phone')).toEqual({ ok: false, error: 'not_done' });
    expect(paid).toEqual([]);
  });

  it('refuses a step the admin set to 0 coins', async () => {
    const { svc } = make({ gender: true }, { gender: 0 });
    expect(await svc.claim('u', 'gender')).toEqual({ ok: false, error: 'no_reward' });
  });

  it('pays the first win and an invited friend only once the server sees them', async () => {
    const lost = make({});
    expect(await lost.svc.claim('u', 'first_win')).toEqual({ ok: false, error: 'not_done' });
    expect(await lost.svc.claim('u', 'invite_friend')).toEqual({ ok: false, error: 'not_done' });
    const won = make({ first_win: true, invite_friend: true });
    expect(await won.svc.claim('u', 'first_win')).toMatchObject({ ok: true, claim: { coins: 25 } });
    expect(await won.svc.claim('u', 'invite_friend')).toMatchObject({ ok: true, claim: { coins: 100 } });
  });

  it('lets an honour mission be claimed once', async () => {
    const { svc } = make({});
    expect(await svc.claim('u', 'follow_instagram')).toMatchObject({ ok: true, claim: { coins: 15 } });
    expect(await svc.claim('u', 'follow_instagram')).toEqual({ ok: false, error: 'already_claimed' });
  });
});
