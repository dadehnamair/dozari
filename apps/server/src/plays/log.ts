import { puzzlePlays } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';

export type PlayMode = 'solo' | 'daily' | 'duel' | 'team';

/** One player's finished board (docs/logic/admin-stats.md). */
export interface PlayRecord {
  userId: string;
  puzzleId: string;
  mode: PlayMode;
  outcome: 'win' | 'loss' | 'draw';
  /** Groups the player found themselves (0-4). */
  groupsSolved: number;
  mistakes: number;
  hintsUsed: number;
}

export interface PlayLog {
  record(plays: readonly PlayRecord[]): Promise<void>;
}

const clamp = (n: number, max: number) => Math.max(0, Math.min(max, Math.trunc(n) || 0));

/** Append-only; a failure only costs a statistics row, so callers fire and forget. */
export function createDbPlayLog(db: Db): PlayLog {
  return {
    async record(plays) {
      if (plays.length === 0) return;
      await db.insert(puzzlePlays).values(
        plays.map((p) => ({ id: uuidv7(), userId: p.userId, puzzleId: p.puzzleId, mode: p.mode, outcome: p.outcome, groupsSolved: clamp(p.groupsSolved, 4), mistakes: clamp(p.mistakes, 32000), hintsUsed: clamp(p.hintsUsed, 32000) })),
      );
    },
  };
}
