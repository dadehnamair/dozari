import { count, eq, guardianLinks, itemLessons, products, puzzles, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import { AGE_TRACKS } from '@dozari/shared';
import type { AgeTrack } from '@dozari/shared';

export interface AgeTrackOverview {
  /** Players per track. */
  players: Record<AgeTrack, number>;
  /** Puzzles per track and status (draft / approved / retired). */
  puzzles: Record<AgeTrack, { draft: number; approved: number; retired: number }>;
  /** Kid items: how many, and how many have no lesson, a draft lesson or an approved one. */
  kidItems: { total: number; missing: number; draft: number; approved: number };
  /** Child profiles held by a guardian. */
  linkedChildren: number;
}

export interface AgeTrackAdmin {
  overview(): Promise<AgeTrackOverview>;
}

const zeroRecord = <T>(make: () => T): Record<AgeTrack, T> => Object.fromEntries(AGE_TRACKS.map((t) => [t, make()])) as Record<AgeTrack, T>;

/** Read-only numbers for the admin «رده‌های سنی» tab (docs/logic/age-tracks.md §Admin panel). */
export function createDbAgeTrackAdmin(db: Db): AgeTrackAdmin {
  return {
    async overview() {
      const players = zeroRecord(() => 0);
      for (const r of await db.select({ t: users.ageTrack, n: count() }).from(users).where(eq(users.isBot, false)).groupBy(users.ageTrack)) players[r.t] = r.n;
      const puz = zeroRecord(() => ({ draft: 0, approved: 0, retired: 0 }));
      for (const r of await db.select({ t: puzzles.ageTrack, s: puzzles.status, n: count() }).from(puzzles).groupBy(puzzles.ageTrack, puzzles.status)) puz[r.t][r.s] = r.n;
      const kid = await db
        .select({ status: itemLessons.status, n: count() })
        .from(products)
        .leftJoin(itemLessons, eq(itemLessons.productId, products.id))
        .where(eq(products.ageTrack, 'kid'))
        .groupBy(itemLessons.status);
      const kidItems = { total: 0, missing: 0, draft: 0, approved: 0 };
      for (const r of kid) {
        kidItems.total += r.n;
        if (r.status === null) kidItems.missing += r.n;
        else kidItems[r.status] += r.n;
      }
      const [linked] = await db.select({ n: count() }).from(guardianLinks);
      return { players, puzzles: puz, kidItems, linkedChildren: linked?.n ?? 0 };
    },
  };
}
