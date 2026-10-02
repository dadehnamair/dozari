import { GROUP_SIZE } from '@dozari/shared';
import type { SoloCard, SubmitOutcome } from '@dozari/shared';

/** Tap a card: select it (up to 4) or deselect it. A 5th tap is ignored. */
export function toggleSelection(selected: readonly string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  if (selected.length >= GROUP_SIZE) return [...selected];
  return [...selected, id];
}

/** Drop selected ids that are no longer on the board (after a group was solved). */
export function pruneSelection(selected: readonly string[], cards: readonly SoloCard[]): string[] {
  const onBoard = new Set(cards.map((c) => c.id));
  return selected.filter((id) => onBoard.has(id));
}

export const canSubmit = (selected: readonly string[]): boolean => selected.length === GROUP_SIZE;

/** Which message to flash after a submission; `invalid` shows nothing. */
export type FeedbackKey = 'correct' | 'oneAway' | 'wrong' | 'duplicate';

export function feedbackFor(outcome: SubmitOutcome): FeedbackKey | null {
  switch (outcome) {
    case 'correct':
      return 'correct';
    case 'one_away':
      return 'oneAway';
    case 'wrong':
      return 'wrong';
    case 'duplicate':
      return 'duplicate';
    case 'invalid':
      return null;
  }
}
