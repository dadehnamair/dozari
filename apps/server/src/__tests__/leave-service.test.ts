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

  it('warns how many leaves remain today before the ban', async () => {
    const { svc } = make();
    expect(await svc.warning('u')).toEqual({ today: 0, left: 4, bannedUntil: null });
    await svc.record('u', 'm1', 'manual');
    await svc.record('u', 'm2', 'manual');
    expect(await svc.warning('u')).toMatchObject({ today: 2, left: 2, bannedUntil: null });
    await svc.record('u', 'm3', 'manual');
    await svc.record('u', 'm4', 'manual');
    const w = await svc.warning('u');
    expect(w.left).toBe(0);
    expect(w.bannedUntil).not.toBeNull();
  });

  it('the admin log lists the newest leaves first with the rules', async () => {
    const { svc, store, set } = make();
    await store.add('a', 'm1', 'manual', noon - 1000);
    set(noon);
    await svc.record('b', 'm2', 'absent');
    const log = await svc.log(10);
    expect(log.rows.map((r) => r.userId)).toEqual(['b', 'a']);
    expect(log.rows[0]!.kind).toBe('absent');
    expect(log.rules.dayBanCount).toBeGreaterThan(0);
  });
});
