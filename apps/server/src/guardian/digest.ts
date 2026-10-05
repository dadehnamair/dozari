import { weekSummary } from '@dozari/shared';
import type { ChildDigest, DigestGame } from '@dozari/shared';
import type { LessonSeenStore } from '../lessons/seen.js';

const WEEK_MS = 7 * 86_400_000;
const RECENT_WORDS = 5;
/** Games read for one digest; a week of play is far below this. */
const GAME_WINDOW = 300;

export interface DigestDeps {
  seen: LessonSeenStore;
  recentGames(userId: string, limit: number): Promise<DigestGame[]>;
  level(userId: string): Promise<number>;
  friendCount(userId: string): Promise<number>;
  now?: () => number;
}

/** «امروز چه یاد گرفت»: the guardian's one-screen summary of a child. Counts and words, never chat text (docs/logic/age-tracks.md §Guardian panel). */
export function createDigestBuilder(deps: DigestDeps): (childId: string) => Promise<ChildDigest> {
  const now = deps.now ?? Date.now;
  return async (childId) => {
    const t = now();
    const [words, games, level, friends] = await Promise.all([deps.seen.summary(childId, t - WEEK_MS, RECENT_WORDS), deps.recentGames(childId, GAME_WINDOW), deps.level(childId), deps.friendCount(childId)]);
    const week = weekSummary(games, t);
    return { wordsTotal: words.total, wordsWeek: words.since, recentWords: words.recent, gamesWeek: week.games, winsWeek: week.wins, daysPlayedWeek: week.daysPlayed, level, friends };
  };
}
