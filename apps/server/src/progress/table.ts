import { asc, levelRoad } from '@dozari/db';
import type { Db } from '@dozari/db';
import { defaultLevelTable } from '@dozari/shared';
import type { LevelRow } from '@dozari/shared';

/** Persistence of the admin's level table (docs/logic/progression.md §Level table). Empty = the formulas of the settings apply. */
export interface LevelTableStore {
  list(): Promise<LevelRow[]>;
  /** Replaces the whole table in one step. */
  replace(rows: readonly LevelRow[]): Promise<void>;
  clear(): Promise<void>;
}

export function createDbLevelTableStore(db: Db): LevelTableStore {
  return {
    async list() {
      const rows = await db.select().from(levelRoad).orderBy(asc(levelRoad.level));
      return rows.map((r) => ({ level: r.level, startXp: r.startXp, rewardCoins: r.rewardCoins, rewardSpins: r.rewardSpins }));
    },
    async replace(rows) {
      await db.transaction(async (tx) => {
        await tx.delete(levelRoad);
        if (rows.length > 0) await tx.insert(levelRoad).values(rows.map((r) => ({ level: r.level, startXp: r.startXp, rewardCoins: r.rewardCoins, rewardSpins: r.rewardSpins ?? 0 })));
      });
    },
    async clear() {
      await db.delete(levelRoad);
    },
  };
}

export function createMemoryLevelTableStore(initial: LevelRow[] = []): LevelTableStore {
  let rows = [...initial];
  return {
    async list() {
      return rows.map((r) => ({ ...r }));
    },
    async replace(next) {
      rows = next.map((r) => ({ ...r }));
    },
    async clear() {
      rows = [];
    },
  };
}

/** The table behind a short cache (every XP read needs it), dropped the moment the admin saves. */
export class LevelTable {
  private cache: { at: number; rows: LevelRow[] | null } | null = null;

  constructor(
    private readonly store: LevelTableStore,
    private readonly ttlMs = 30_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** The admin's rows, or null when none are set (use the formulas). */
  async get(): Promise<LevelRow[] | null> {
    if (this.cache && this.now() - this.cache.at < this.ttlMs) return this.cache.rows;
    const rows = await this.store.list();
    this.cache = { at: this.now(), rows: rows.length > 0 ? rows : null };
    return this.cache.rows;
  }

  async set(rows: readonly LevelRow[]): Promise<void> {
    await this.store.replace(rows);
    this.cache = null;
  }

  async reset(): Promise<void> {
    await this.store.clear();
    this.cache = null;
  }
}

export { defaultLevelTable };
