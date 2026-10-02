import { describe, expect, it } from 'vitest';
import { dailyDateKey, dateKeysFrom, isDateKey, pickDaily, themeActiveOn } from '../pick.js';
import type { DailyCandidates } from '../pick.js';

const base = { weight: 1, startMonth: null, startDay: null, endMonth: null, endDay: null, fromDate: null, toDate: null };

describe('daily dates', () => {
  it('uses the Tehran calendar day', () => {
    expect(dailyDateKey(Date.UTC(2026, 9, 2, 20, 29))).toBe('2026-10-02');
    expect(dailyDateKey(Date.UTC(2026, 9, 2, 20, 31))).toBe('2026-10-03');
  });
  it('validates keys and lists days', () => {
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-10-02')).toBe(true);
    expect(dateKeysFrom('2026-10-30', 3)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
  });
});

describe('themeActiveOn', () => {
  it('matches a recurring Solar Hijri window', () => {
    // 2026-03-21 = 1 Farvardin 1405
    const nowruz = { ...base, startMonth: 12, startDay: 25, endMonth: 1, endDay: 5 };
    expect(themeActiveOn(nowruz, '2026-03-21')).toBe(true); // wraps the year end
    expect(themeActiveOn(nowruz, '2026-06-01')).toBe(false);
  });
  it('matches an absolute window and open themes', () => {
    expect(themeActiveOn({ ...base, fromDate: '2026-10-01', toDate: '2026-10-05' }, '2026-10-06')).toBe(false);
    expect(themeActiveOn({ ...base, fromDate: '2026-10-01' }, '2026-12-06')).toBe(true);
    expect(themeActiveOn(base, '2026-12-06')).toBe(true);
  });
});

describe('pickDaily', () => {
  const themes: DailyCandidates[] = [
    { ...base, id: 'nowruz', startMonth: 12, startDay: 25, endMonth: 1, endDay: 5, puzzleIds: ['n1', 'n2'] },
    { ...base, id: 'always', puzzleIds: ['a1'] },
  ];
  const all = ['n1', 'n2', 'a1', 'z1'];
  it('is deterministic per date', () => {
    const a = pickDaily({ dateKey: '2026-10-02', themes, allPuzzleIds: all, recentPuzzleIds: new Set() });
    expect(a).toEqual(pickDaily({ dateKey: '2026-10-02', themes, allPuzzleIds: all, recentPuzzleIds: new Set() }));
    expect(a?.themeId).toBe('always');
  });
  it('prefers a themed puzzle on its days', () => {
    const picks = new Set(['2026-03-21', '2026-03-22', '2026-03-23', '2026-03-24'].map((d) => pickDaily({ dateKey: d, themes, allPuzzleIds: all, recentPuzzleIds: new Set() })?.themeId));
    expect(picks.has('nowruz')).toBe(true);
  });
  it('skips recent puzzles, then falls back, then repeats', () => {
    expect(pickDaily({ dateKey: '2026-10-02', themes, allPuzzleIds: all, recentPuzzleIds: new Set(['a1']) })).toEqual({ puzzleId: expect.stringMatching(/^(n1|n2|z1)$/), themeId: null });
    expect(pickDaily({ dateKey: '2026-10-02', themes, allPuzzleIds: all, recentPuzzleIds: new Set(all) })?.puzzleId).toBeTruthy();
    expect(pickDaily({ dateKey: '2026-10-02', themes: [], allPuzzleIds: [], recentPuzzleIds: new Set() })).toBeNull();
  });
});
