import type { GroupLevel } from '@dozari/shared';

/** A puzzle as the server holds it: the full solution plus the texts revealed on solving. */
export interface ServedPuzzle {
  id: string;
  groups: readonly {
    level: GroupLevel;
    productIds: readonly string[];
    titleFa: string;
    explanationFa: string;
  }[];
  /** Everything a card shows. No prices during play (docs/logic/puzzle-generation.md §Board). */
  items: Readonly<Record<string, { nameFa: string; unitFa: string | null }>>;
}

/** I/O boundary: where playable puzzles come from. */
export interface PuzzleSource {
  /** A random approved puzzle, or null when none exist. */
  pickRandom(): Promise<ServedPuzzle | null>;
}

/** What a client may see. Unsolved groups' membership and texts never appear (rule 4). */
export interface SoloView {
  sessionId: string;
  puzzleId: string;
  cards: { id: string; nameFa: string; unitFa: string | null }[];
  solved: {
    level: GroupLevel;
    titleFa: string;
    explanationFa: string;
    productIds: string[];
    /** Shown by the game (auto-reveal / game over) rather than found by the player. */
    revealed: boolean;
  }[];
  mistakes: number;
  maxMistakes: number;
  status: 'playing' | 'won' | 'lost';
}
