import { and, count, desc, eq, guardianLinks, inArray, itemLessons, like, or, products, puzzles, users } from '@dozari/db';
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

/** A guardian with the children they hold, for the admin «ولی‌ها» tab (support: look up, unlink, move a child). */
export interface GuardianRow {
  id: string;
  nickname: string;
  /** Verified number; the route blanks it for roles without the `users` permission. */
  phone: string | null;
  children: { id: string; nickname: string; track: AgeTrack; linkedAt: number }[];
}

export interface AgeTrackAdmin {
  overview(): Promise<AgeTrackOverview>;
  /** Guardians (newest link first), optionally filtered by nickname or number. */
  guardians(q: string, limit: number): Promise<GuardianRow[]>;
  /** Removes a child's guardian link (the profile stays, back to the safest rules); false when there was none. */
  unlink(childId: string): Promise<boolean>;
  /** Moves a child profile to another child track (support action); false when the child is unknown or has no guardian. */
  setChildTrack(childId: string, track: 'kid' | 'teen'): Promise<boolean>;
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
    async guardians(q, limit) {
      const term = q.trim();
      const links = await db
        .select({ guardianId: guardianLinks.guardianId, childId: guardianLinks.childId, linkedAt: guardianLinks.createdAt })
        .from(guardianLinks)
        .orderBy(desc(guardianLinks.createdAt));
      const guardianIds = [...new Set(links.map((l) => l.guardianId))];
      if (guardianIds.length === 0) return [];
      const matches = term ? or(like(users.nickname, `%${term}%`), like(users.phone, `%${term}%`)) : undefined;
      const people = await db.select({ id: users.id, nickname: users.nickname, phone: users.phone }).from(users).where(and(inArray(users.id, guardianIds), matches));
      const kids = await db.select({ id: users.id, nickname: users.nickname, track: users.ageTrack }).from(users).where(inArray(users.id, links.map((l) => l.childId)));
      const kidById = new Map(kids.map((k) => [k.id, k]));
      return people
        .map((g): GuardianRow => ({
          id: g.id,
          nickname: g.nickname,
          phone: g.phone,
          children: links
            .filter((l) => l.guardianId === g.id)
            .map((l) => ({ id: l.childId, nickname: kidById.get(l.childId)?.nickname ?? '؟', track: kidById.get(l.childId)?.track ?? 'kid', linkedAt: l.linkedAt.getTime() })),
        }))
        .slice(0, limit);
    },
    async unlink(childId) {
      const [res] = await db.delete(guardianLinks).where(eq(guardianLinks.childId, childId));
      return res.affectedRows > 0;
    },
    async setChildTrack(childId, track) {
      const [link] = await db.select({ c: guardianLinks.childId }).from(guardianLinks).where(eq(guardianLinks.childId, childId));
      if (!link) return false;
      await db.update(users).set({ ageTrack: track, ageTrackSetAt: new Date() }).where(eq(users.id, childId));
      return true;
    },
  };
}
