import { z } from 'zod';

const DAY_MS = 86_400_000;

/** One finished game of a child, as far as the digest cares. */
export interface DigestGame {
  outcome: 'win' | 'loss' | 'draw' | null;
  /** Epoch ms. */
  at: number;
}

/** Games, wins and the number of different days played inside the last `days` days (docs/logic/age-tracks.md §Guardian panel). */
export function weekSummary(games: readonly DigestGame[], now: number, days = 7, dayOf: (ms: number) => string = (ms) => String(Math.floor(ms / DAY_MS))) {
  const since = now - days * DAY_MS;
  const inside = games.filter((g) => g.at >= since && g.at <= now);
  return { games: inside.length, wins: inside.filter((g) => g.outcome === 'win').length, daysPlayed: new Set(inside.map((g) => dayOf(g.at))).size };
}

/** What a guardian reads about one child: «امروز چه یاد گرفت». Counts and words only, never chat text. */
export const childDigestSchema = z.object({
  wordsTotal: z.number().int().min(0),
  wordsWeek: z.number().int().min(0),
  /** The last few words learned, newest first. */
  recentWords: z.array(z.string()).max(10),
  gamesWeek: z.number().int().min(0),
  winsWeek: z.number().int().min(0),
  daysPlayedWeek: z.number().int().min(0).max(7),
  level: z.number().int().min(1),
  friends: z.number().int().min(0),
  /** Minutes in the app over the last 7 days (the app's heartbeat); 0 when the child's app never reported. */
  minutesWeek: z.number().int().min(0).default(0),
});
export type ChildDigest = z.infer<typeof childDigestSchema>;
