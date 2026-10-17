import { and, botGroupPlays, botGroups, eq } from '@dozari/db';
import type { Db } from '@dozari/db';

export type GroupPlayResult = 'playing' | 'won' | 'lost';

/** I/O boundary of the group game (docs/logic/group-game.md). */
export interface GroupGameStore {
  /** Registers the group, or brings a removed one back; keeps the title fresh. */
  upsertGroup(g: { chatId: string; platform: 'bale' | 'telegram'; title: string }): Promise<void>;
  /** The bot was removed from the group. */
  markRemoved(chatId: string): Promise<void>;
  play(chatId: string, dateKey: string): Promise<{ result: GroupPlayResult } | null>;
  /** True when this call created the day's play (the primary key is the one-play rule). */
  startPlay(chatId: string, dateKey: string): Promise<boolean>;
  /** True when the play moved from playing to its result. */
  finishPlay(chatId: string, dateKey: string, f: { result: 'won' | 'lost'; mistakes: number; solvedGroups: number; players: number }): Promise<boolean>;
}

export function createDbGroupGameStore(db: Db): GroupGameStore {
  return {
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
  };
}
