import { desc, eq, gte, inArray, itemLessons, lessonViews, sql } from '@dozari/db';
import type { Db } from '@dozari/db';
import { and } from '@dozari/db';

/** Which word lessons a player has seen, for the guardian's digest. The words only; nothing a child typed. */
export interface LessonSeenStore {
  /** A lesson card was shown: first time or again. */
  record(userId: string, productIds: readonly string[], now: number): Promise<void>;
  /** How many different words were seen (ever, and since `sinceMs`) and the newest few. */
  summary(userId: string, sinceMs: number, recent: number): Promise<{ total: number; since: number; recent: string[] }>;
}

export function createDbLessonSeenStore(db: Db): LessonSeenStore {
  return {
    async record(userId, productIds, now) {
      for (const productId of new Set(productIds)) {
        await db
          .insert(lessonViews)
          .values({ userId, productId, firstSeenAt: new Date(now), lastSeenAt: new Date(now) })
          .onDuplicateKeyUpdate({ set: { lastSeenAt: new Date(now), times: sql`${lessonViews.times} + 1` } });
      }
    },
    async summary(userId, sinceMs, recent) {
      const [total] = await db.select({ n: sql<number>`COUNT(*)` }).from(lessonViews).where(eq(lessonViews.userId, userId));
      const [since] = await db.select({ n: sql<number>`COUNT(*)` }).from(lessonViews).where(and(eq(lessonViews.userId, userId), gte(lessonViews.firstSeenAt, new Date(sinceMs))));
      const rows = await db.select({ productId: lessonViews.productId }).from(lessonViews).where(eq(lessonViews.userId, userId)).orderBy(desc(lessonViews.lastSeenAt)).limit(recent);
      const words = rows.length ? await db.select({ id: itemLessons.productId, word: itemLessons.wordFa }).from(itemLessons).where(inArray(itemLessons.productId, rows.map((r) => r.productId))) : [];
      const byId = new Map(words.map((w) => [w.id, w.word]));
      return { total: Number(total?.n ?? 0), since: Number(since?.n ?? 0), recent: rows.map((r) => byId.get(r.productId)).filter((w): w is string => !!w) };
    },
  };
}

export function createMemoryLessonSeenStore(words: Record<string, string> = {}): LessonSeenStore & { seen: Map<string, Map<string, { first: number; last: number }>> } {
  const seen = new Map<string, Map<string, { first: number; last: number }>>();
  return {
    seen,
    async record(userId, productIds, now) {
      const mine = seen.get(userId) ?? new Map();
      for (const id of productIds) mine.set(id, { first: mine.get(id)?.first ?? now, last: now });
      seen.set(userId, mine);
    },
    async summary(userId, sinceMs, recent) {
      const mine = [...(seen.get(userId) ?? new Map<string, { first: number; last: number }>())];
      return {
        total: mine.length,
        since: mine.filter(([, v]) => v.first >= sinceMs).length,
        recent: mine.sort((a, b) => b[1].last - a[1].last).slice(0, recent).map(([id]) => words[id] ?? id),
      };
    },
  };
}
