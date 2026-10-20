import { and, botGroupPlays, botGroupPriceSessions, botGroupScores, botGroups, desc, eq, sql } from '@dozari/db';
import { randomInt } from 'node:crypto';
import type { Db } from '@dozari/db';
import type { GroupScoreRow } from '@dozari/shared';

export type GroupPlayResult = 'playing' | 'won' | 'lost';

/** I/O boundary of the group game (docs/logic/group-game.md). */
export interface GroupGameStore {
  /** The group's short code for its mini-app links (made on first use, lowercase letters and digits). */
  refOf(chatId: string): Promise<string | null>;
  /** Registers the group, or brings a removed one back; keeps the title fresh. */
  upsertGroup(g: { chatId: string; platform: 'bale' | 'telegram'; title: string }): Promise<void>;
  /** The bot was removed from the group. */
  markRemoved(chatId: string): Promise<void>;
  play(chatId: string, dateKey: string): Promise<{ result: GroupPlayResult } | null>;
  /** True when this call created the day's play (the primary key is the one-play rule). */
  startPlay(chatId: string, dateKey: string): Promise<boolean>;
  /** True when the play moved from playing to its result. */
  finishPlay(chatId: string, dateKey: string, f: { result: 'won' | 'lost'; mistakes: number; solvedGroups: number; players: number }): Promise<boolean>;
  /** Counts one `/price` session for the day; false when the group already used `max` of them. */
  startPriceSession(chatId: string, dateKey: string, max: number): Promise<boolean>;
  /** Counts one `/question` session for the day; false when the group already used `max` of them. */
  startQuestionSession(chatId: string, dateKey: string, max: number): Promise<boolean>;
  /** Adds to one member's tally for the week (created on first use). */
  addScore(chatId: string, weekKey: string, d: { userRef: string; name: string; points: number; groups: number; wrong: number; userId?: string | null }): Promise<void>;
  /** The week's tallies of a group, any order (the caller ranks). */
  weekScores(chatId: string, weekKey: string, limit: number): Promise<GroupScoreRow[]>;
}

const REF_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const newRef = (): string => Array.from({ length: 7 }, () => REF_ALPHABET[randomInt(REF_ALPHABET.length)]).join('');

export function createDbGroupGameStore(db: Db): GroupGameStore {
  return {
    async refOf(chatId) {
      const [row] = await db.select({ ref: botGroups.ref }).from(botGroups).where(eq(botGroups.chatId, chatId)).limit(1);
      if (!row) return null;
      if (row.ref) return row.ref;
      // a clash on the unique code (rare) just draws another one
      for (let i = 0; i < 5; i++) {
        const ref = newRef();
        try {
          const [res] = await db.update(botGroups).set({ ref }).where(and(eq(botGroups.chatId, chatId), sql`${botGroups.ref} IS NULL`));
          if (res.affectedRows > 0) return ref;
          return (await db.select({ ref: botGroups.ref }).from(botGroups).where(eq(botGroups.chatId, chatId)).limit(1))[0]?.ref ?? null;
        } catch {
          /* duplicate code: try another */
        }
      }
      return null;
    },
    async upsertGroup(g) {
      await db
        .insert(botGroups)
        .values({ chatId: g.chatId, platform: g.platform, title: g.title.slice(0, 200) })
        .onDuplicateKeyUpdate({ set: { platform: g.platform, title: g.title.slice(0, 200), removedAt: null } });
    },
    async markRemoved(chatId) {
      await db.update(botGroups).set({ removedAt: new Date() }).where(eq(botGroups.chatId, chatId));
    },
    async play(chatId, dateKey) {
      const [row] = await db
        .select({ result: botGroupPlays.result })
        .from(botGroupPlays)
        .where(and(eq(botGroupPlays.chatId, chatId), eq(botGroupPlays.dateKey, dateKey)))
        .limit(1);
      return row ?? null;
    },
    async startPlay(chatId, dateKey) {
      const [res] = await db.insert(botGroupPlays).ignore().values({ chatId, dateKey });
      return res.affectedRows > 0;
    },
    async finishPlay(chatId, dateKey, f) {
      const [res] = await db
        .update(botGroupPlays)
        .set({ result: f.result, mistakes: f.mistakes, solvedGroups: f.solvedGroups, players: f.players, finishedAt: new Date() })
        .where(and(eq(botGroupPlays.chatId, chatId), eq(botGroupPlays.dateKey, dateKey), eq(botGroupPlays.result, 'playing')));
      return res.affectedRows > 0;
    },
    async startPriceSession(chatId, dateKey, max) {
      await db.insert(botGroupPriceSessions).ignore().values({ chatId, dateKey });
      const [res] = await db
        .update(botGroupPriceSessions)
        .set({ sessions: sql`${botGroupPriceSessions.sessions} + 1` })
        .where(and(eq(botGroupPriceSessions.chatId, chatId), eq(botGroupPriceSessions.dateKey, dateKey), sql`${botGroupPriceSessions.sessions} < ${max}`));
      return res.affectedRows > 0;
    },
    async startQuestionSession(chatId, dateKey, max) {
      await db.insert(botGroupPriceSessions).ignore().values({ chatId, dateKey });
      const [res] = await db
        .update(botGroupPriceSessions)
        .set({ questionSessions: sql`${botGroupPriceSessions.questionSessions} + 1` })
        .where(and(eq(botGroupPriceSessions.chatId, chatId), eq(botGroupPriceSessions.dateKey, dateKey), sql`${botGroupPriceSessions.questionSessions} < ${max}`));
      return res.affectedRows > 0;
    },
    async addScore(chatId, weekKey, d) {
      const name = d.name.slice(0, 100);
      await db
        .insert(botGroupScores)
        .values({ chatId, weekKey, userRef: d.userRef, name, points: d.points, groups: d.groups, wrong: d.wrong, userId: d.userId ?? null })
        .onDuplicateKeyUpdate({ set: { name, ...(d.userId ? { userId: d.userId } : {}), points: sql`${botGroupScores.points} + ${d.points}`, groups: sql`${botGroupScores.groups} + ${d.groups}`, wrong: sql`${botGroupScores.wrong} + ${d.wrong}` } });
    },
    async weekScores(chatId, weekKey, limit) {
      return db
        .select({ userRef: botGroupScores.userRef, name: botGroupScores.name, points: botGroupScores.points, groups: botGroupScores.groups, wrong: botGroupScores.wrong })
        .from(botGroupScores)
        .where(and(eq(botGroupScores.chatId, chatId), eq(botGroupScores.weekKey, weekKey)))
        .orderBy(desc(botGroupScores.points))
        .limit(limit * 3); // a few extra so ties can be re-ranked by the caller
    },
  };
}
