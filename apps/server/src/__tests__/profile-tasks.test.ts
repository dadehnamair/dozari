import { describe, expect, it } from 'vitest';
import { profileTasksSchema } from '@dozari/shared';
import type { ProfileTaskKey } from '@dozari/shared';
import { ProfileTaskService } from '../profile/tasks.js';

describe('profile tasks (D161)', () => {
  const make = (facts: Partial<Record<ProfileTaskKey, boolean>>, coins: Partial<Record<ProfileTaskKey, number>> = {}) => {
    const claimed = new Set<ProfileTaskKey>();
    const paid: [ProfileTaskKey, number][] = [];
    let balance = 100;
    const svc = new ProfileTaskService({
      facts: async () => ({ gender: false, city: false, phone: false, bale: false, ...facts }),
      coins: async () => ({ gender: 10, city: 20, phone: 50, bale: 30, ...coins }),
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
    expect(out.tasks.map((t) => [t.key, t.done, t.claimed, t.coins])).toEqual([['gender', false, false, 10], ['city', true, false, 20], ['phone', false, false, 50], ['bale', false, false, 30]]);
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
});
