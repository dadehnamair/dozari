import { SOLO_MAX_MISTAKES } from '../config/index.js';
import { shuffleBoard, startSolo, submitGuess } from '../game/solo.js';
import type { SoloState } from '../game/solo.js';
import type { Rng } from '../game/rng.js';
import type { SoloGuessResult, SoloOfflinePuzzle, SoloView } from './contract.js';

/**
 * A solo game played on the phone from a saved puzzle (docs/logic/offline-solo.md): the same pure reducer as the server's
 * `SoloService`, shaped into the same `SoloView`, so the screen cannot tell the difference. Pure; the caller keeps the session.
 */
export interface LocalSoloSession {
  sessionId: string;
  puzzle: SoloOfflinePuzzle;
  state: SoloState;
  maxMistakes: number;
}

export function startLocalSolo(puzzle: SoloOfflinePuzzle, rng: Rng, sessionId: string, maxMistakes: number = SOLO_MAX_MISTAKES): LocalSoloSession {
  return { sessionId, puzzle, state: startSolo(puzzle, rng), maxMistakes };
}

export function localView(s: LocalSoloSession): SoloView {
  const byLevel = new Map(s.puzzle.groups.map((g) => [g.level, g]));
  return {
    sessionId: s.sessionId,
    puzzleId: s.puzzle.id,
    cards: s.state.remaining.map((id) => {
      const item = s.puzzle.items[id];
      return { id, nameFa: item?.nameFa ?? id, unitFa: item?.unitFa ?? null, iconKey: item?.iconKey ?? null };
    }),
    solved: s.state.solved.map((g) => ({
      level: g.level,
      titleFa: byLevel.get(g.level)?.titleFa ?? '',
      explanationFa: byLevel.get(g.level)?.explanationFa ?? '',
      productIds: [...g.productIds],
      revealed: g.revealed,
    })),
    mistakes: s.state.mistakes,
    maxMistakes: s.maxMistakes,
    status: s.state.status,
  };
}

/** Plays one guess; returns the next session and what the screen needs (`outcome`, the new view). */
export function localGuess(s: LocalSoloSession, productIds: readonly string[]): { session: LocalSoloSession; result: SoloGuessResult } {
  const r = submitGuess(s.state, s.puzzle, productIds, s.maxMistakes);
  const session = { ...s, state: r.state };
  return { session, result: { outcome: r.outcome, solvedLevel: r.solvedLevel, view: localView(session) } };
}

export function localShuffle(s: LocalSoloSession, rng: Rng): LocalSoloSession {
  return { ...s, state: shuffleBoard(s.state, rng) };
}
