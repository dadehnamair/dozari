import { TRIVIA_POOL_FETCH, TRIVIA_SEEN_KEEP, pickFreshTrivia } from '@dozari/shared';
import type { AgeTrack, Rng, TriviaQuestion } from '@dozari/shared';
import { and, desc, eq, lte, triviaSeen } from '@dozari/db';
import type { Db } from '@dozari/db';
import type { TriviaStore } from './store.js';

/** What each player has already seen of the general questions (docs/logic/trivia.md §No repeats). */
export interface TriviaSeenStore {
  /** Question id → when this player last saw it (ms), for their newest `TRIVIA_SEEN_KEEP` questions. */
  seen(userId: string): Promise<Map<string, number>>;
  /** Notes that the player saw these questions now; older rows beyond the newest `TRIVIA_SEEN_KEEP` are dropped. */
  mark(userId: string, questionIds: readonly string[], at: number): Promise<void>;
}

export function createDbTriviaSeenStore(db: Db): TriviaSeenStore {
  return {
    async seen(userId) {
      const rows = await db.select({ q: triviaSeen.questionId, at: triviaSeen.seenAt }).from(triviaSeen).where(eq(triviaSeen.userId, userId)).orderBy(desc(triviaSeen.seenAt)).limit(TRIVIA_SEEN_KEEP);
      return new Map(rows.map((r) => [r.q, r.at.getTime()] as const));
    },
    async mark(userId, questionIds, at) {
      if (questionIds.length === 0) return;
      await db
        .insert(triviaSeen)
        .values(questionIds.map((questionId) => ({ userId, questionId, seenAt: new Date(at) })))
        .onDuplicateKeyUpdate({ set: { seenAt: new Date(at) } });
      // Keep only the newest rows: everything at or before the (KEEP+1)th newest goes.
      const [edge] = await db.select({ at: triviaSeen.seenAt }).from(triviaSeen).where(eq(triviaSeen.userId, userId)).orderBy(desc(triviaSeen.seenAt)).limit(1).offset(TRIVIA_SEEN_KEEP);
      if (edge) await db.delete(triviaSeen).where(and(eq(triviaSeen.userId, userId), lte(triviaSeen.seenAt, edge.at)));
    },
  };
}

export function createMemoryTriviaSeenStore(): TriviaSeenStore & { rows: Map<string, Map<string, number>> } {
  const rows = new Map<string, Map<string, number>>();
  return {
    rows,
    async seen(userId) {
      return new Map(rows.get(userId) ?? []);
    },
    async mark(userId, questionIds, at) {
      const m = rows.get(userId) ?? new Map<string, number>();
      for (const q of questionIds) m.set(q, at);
      if (m.size > TRIVIA_SEEN_KEEP) for (const [q] of [...m].sort((a, b) => a[1] - b[1]).slice(0, m.size - TRIVIA_SEEN_KEEP)) m.delete(q);
      rows.set(userId, m);
    },
  };
}

/**
 * Draws `count` questions for these players: from the topic (or topics, or the whole bank), the ones none of the `userIds` has seen first,
 * then the ones fewer saw, then the oldest seen (`pickFreshTrivia`). `userIds` are humans only; without a seen store it is a plain random draw.
 * With several `topicIds` (a themed board duel) their questions come first and the rest of the bank fills a short round.
 */
export async function drawTrivia(store: TriviaStore, seen: TriviaSeenStore | undefined, o: { topicId?: string; topicIds?: readonly string[]; tracks: readonly AgeTrack[]; count: number; rng: Rng; userIds: readonly string[]; /** Difficulty (1–3) that fits the players' level, when level matching is on (docs/logic/trivia.md §Difficulty). */ target?: number }): Promise<TriviaQuestion[]> {
  const histories = seen ? await Promise.all([...new Set(o.userIds)].map((u) => seen.seen(u).catch(() => new Map<string, number>()))) : [];
  const topics = o.topicIds?.length ? [...new Set(o.topicIds)] : o.topicId ? [o.topicId] : [];
  const own = topics.length ? (await Promise.all(topics.map((topicId) => store.approved({ topicId, tracks: o.tracks, limit: TRIVIA_POOL_FETCH })))).flat() : [];
  const picked = topics.length ? pickFreshTrivia(own, o.count, o.rng, histories, undefined, o.target) : [];
  if (picked.length >= o.count || (topics.length > 0 && o.topicId)) return picked; // a chosen topic is never padded from other topics
  const bank = await store.approved({ tracks: o.tracks, limit: TRIVIA_POOL_FETCH });
  const have = new Set(picked.map((q) => q.id));
  return [...picked, ...pickFreshTrivia(bank.filter((q) => !have.has(q.id)), o.count - picked.length, o.rng, histories, undefined, o.target)];
}
