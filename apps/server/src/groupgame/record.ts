import type { GroupGameStore } from './store.js';
import type { GroupRewardStore } from './rewards.js';

export interface ScoreDelta {
  userRef: string;
  name: string;
  points: number;
  groups: number;
  wrong: number;
}

export interface GroupRecorderDeps {
  store: GroupGameStore;
  /** The game account behind a messenger id (link or mini-app login), or null. */
  userOf?: (userRef: string) => Promise<string | null>;
  /** Only these accounts are paid (the adult track); absent = everyone linked. */
  eligible?: (userId: string) => Promise<boolean>;
  rewards?: GroupRewardStore;
  /** Called after a player was paid, e.g. to run level/badge checks. */
  onPaid?: (userId: string) => void | Promise<void>;
  log?: (msg: string, err?: unknown) => void;
}

/**
 * The one place a group point is saved (docs/logic/group-game.md §Account rewards): the weekly tally of the group, with the game account
 * attached when there is one, and the points paid to that account as XP and coins.
 */
export class GroupScoreRecorder {
  constructor(private readonly d: GroupRecorderDeps) {}

  async record(chatId: string, weekKey: string, dateKey: string, delta: ScoreDelta): Promise<void> {
    const userId = await this.d.userOf?.(delta.userRef).catch(() => null) ?? null;
    await this.d.store.addScore(chatId, weekKey, { ...delta, userId });
    if (!userId || delta.points <= 0 || !this.d.rewards) return;
    try {
      if (this.d.eligible && !(await this.d.eligible(userId))) return;
      const paid = await this.d.rewards.credit(userId, dateKey, delta.points);
      if (paid.coins > 0 || paid.xp > 0) await this.d.onPaid?.(userId);
    } catch (err) {
      this.d.log?.('group: paying the account failed', err);
    }
  }
}
