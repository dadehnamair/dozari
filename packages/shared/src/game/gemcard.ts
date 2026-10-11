import type { Rng } from './rng.js';

/**
 * Gem card: with chance `percent` a game hides one gem behind a random card of the board. Pure and seeded (rule: game-logic randomness is injected).
 * Returns the card's id, or null when this game has no gem.
 */
export function rollGemCard(cardIds: readonly string[], percent: number, rng: Rng): string | null {
  if (cardIds.length === 0 || !(percent > 0)) return null;
  if (rng() * 100 >= Math.min(100, percent)) return null;
  return cardIds[Math.floor(rng() * cardIds.length)] ?? null;
}

/** Does a correctly guessed group hold the gem card? */
export const groupHoldsGem = (gemCard: string | null | undefined, groupIds: readonly string[]): boolean => !!gemCard && groupIds.includes(gemCard);
