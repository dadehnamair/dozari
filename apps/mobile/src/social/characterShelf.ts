import type { AvatarShelf } from '@dozari/shared';
import { fa } from '../i18n/fa';

/** What tapping a cast character does: wear it, buy it first, or explain why not yet (the server decides; this only words it). */
export type CharacterTap = { kind: 'wear' } | { kind: 'buy'; price: number } | { kind: 'blocked'; text: string };

export function characterTap(key: string, shelf: AvatarShelf | null): CharacterTap {
  const item = shelf?.items.find((i) => i.key === key);
  // No shelf (offline, or the server has no shop): behave as before and let the server answer.
  if (!item || item.owned) return { kind: 'wear' };
  const b = fa.avatarShelf.blocked;
  switch (item.blocked) {
    case 'NEEDS_GAMES': return { kind: 'blocked', text: b.NEEDS_GAMES(shelf!.unlockGames) };
    case 'NEEDS_INVITE': return { kind: 'blocked', text: b.NEEDS_INVITE };
    case 'NEEDS_LEVEL': return { kind: 'blocked', text: b.NEEDS_LEVEL(shelf!.minLevel) };
    case 'NEEDS_COINS': return { kind: 'blocked', text: b.NEEDS_COINS };
    default: return { kind: 'buy', price: item.priceCoins };
  }
}

/** The small label under a character: its price, "free", or nothing for one the player owns. */
export function characterTag(key: string, shelf: AvatarShelf | null): string | null {
  const item = shelf?.items.find((i) => i.key === key);
  if (!item || item.owned) return null;
  return fa.avatarShelf.price(item.priceCoins);
}
