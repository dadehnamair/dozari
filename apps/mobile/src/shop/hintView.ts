import type { HintPayload, SoloHints } from '@dozari/shared';
import { fa } from '../i18n/fa';

/** Cards that paid hints pointed at (frame them on the board). */
export function hintedCardIds(given: readonly HintPayload[]): string[] {
  return given.flatMap((h) => (h.kind === 'one_card' ? [h.productId] : h.kind === 'pair' ? [...h.productIds] : []));
}

/** Group names that paid hints revealed, to show above the board. */
export function hintedTitles(given: readonly HintPayload[]): string[] {
  return given.flatMap((h) => (h.kind === 'group_title' ? [h.titleFa] : []));
}

/** Why hints cannot be taken right now, in Persian, or null when they can. */
export function hintBlockedText(h: Pick<SoloHints, 'blocked' | 'minLevel' | 'max'>): string | null {
  if (h.blocked === 'LEVEL') return fa.hints.needLevel(h.minLevel);
  if (h.blocked === 'LIMIT') return fa.hints.limit(h.max);
  return null;
}
