import { describe, expect, it } from 'vitest';
import { tehranDayStart } from '@dozari/shared';
import { LeaveService, createMemoryLeaveStore } from '../leaves/service.js';

const DAY = 24 * 3_600_000;

describe('LeaveService', () => {
  const noon = tehranDayStart(Date.UTC(2026, 9, 12, 8)) + 12 * 3_600_000;
  const make = () => {
    const store = createMemoryLeaveStore();
    let now = noon;
    const svc = new LeaveService(store, undefined, () => now);
    return { store, svc, set: (t: number) => (now = t) };
  };

  it('bans after the fourth leave of the day and lifts at the next Tehran day', async () => {
    const { svc, set } = make();
    for (let i = 0; i < 3; i++) await svc.record('u', `m${i}`, 'manual');
    expect(await svc.isBanned('u')).toBe(false);
    await svc.record('u', 'm3', 'absent');
    expect(await svc.isBanned('u')).toBe(true);
    set(tehranDayStart(noon) + DAY + 1000);
    expect(await svc.isBanned('u')).toBe(false);
  });

  it('puts the badge on after eight leaves in a month and keeps it per user', async () => {
    const { svc, store } = make();
    for (let i = 1; i <= 8; i++) await store.add('u', null, 'manual', noon - i * 2 * DAY);
    const s = await svc.status('u');
    expect(s.badgeUntil).not.toBeNull();
    expect((await svc.status('other')).badgeUntil).toBeNull();
  });
});
