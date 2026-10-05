import { describe, expect, it } from 'vitest';
import { GuardianService } from '../guardian/service.js';
import type { GuardianStore } from '../guardian/service.js';
import { createDigestBuilder } from '../guardian/digest.js';
import { createMemoryLessonSeenStore } from '../lessons/seen.js';

const DAY = 86_400_000;
const NOW = 100 * DAY;

describe('guardian digest (age-tracks phase 5)', () => {
  it('summarises words learned, the week of play, level and friends', async () => {
    const seen = createMemoryLessonSeenStore({ nan: 'نان', sib: 'سیب', gol: 'گل' });
    await seen.record('kid', ['nan'], NOW - 20 * DAY); // an old word
    await seen.record('kid', ['sib'], NOW - 2 * DAY);
    await seen.record('kid', ['gol', 'sib'], NOW - 1000);
    const build = createDigestBuilder({
      seen,
      recentGames: async () => [{ outcome: 'win', at: NOW - 100 }, { outcome: 'loss', at: NOW - 3 * DAY }, { outcome: 'win', at: NOW - 30 * DAY }],
      level: async () => 4,
      friendCount: async () => 2,
      now: () => NOW,
    });
    expect(await build('kid')).toEqual({ wordsTotal: 3, wordsWeek: 2, recentWords: ['سیب', 'گل', 'نان'], gamesWeek: 2, winsWeek: 1, daysPlayedWeek: 2, level: 4, friends: 2 });
  });

  it('only the child’s own guardian may read it', async () => {
    const svc = new GuardianService({ isChildOf: async (g: string, c: string) => g === 'g1' && c === 'k1' } as unknown as GuardianStore, {} as never, {} as never, {} as never, {} as never, () => 'd');
    svc.digest = async () => ({ wordsTotal: 0, wordsWeek: 0, recentWords: [], gamesWeek: 0, winsWeek: 0, daysPlayedWeek: 0, level: 1, friends: 0 });
    expect(await svc.digestOf('g1', 'k1')).toMatchObject({ ok: true });
    expect(await svc.digestOf('g2', 'k1')).toMatchObject({ ok: false, error: 'not_found' });
  });

  it('shows words, never a child’s typed text', async () => {
    const seen = createMemoryLessonSeenStore({ nan: 'نان' });
    await seen.record('kid', ['nan'], NOW);
    const json = JSON.stringify(await createDigestBuilder({ seen, recentGames: async () => [], level: async () => 1, friendCount: async () => 0, now: () => NOW })('kid'));
    expect(Object.keys(JSON.parse(json))).not.toContain('messages');
  });
});
