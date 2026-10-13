import { describe, expect, it } from 'vitest';
import type { AvatarShelf } from '@dozari/shared';
import { characterTag, characterTap } from '../characterShelf';

const shelf = (blocked: AvatarShelf['items'][number]['blocked']): AvatarShelf => ({
  items: [
    { key: 'char-dozari', priceCoins: 0, owned: true, current: true, blocked: null },
    { key: 'char-pahlevan', priceCoins: 500, owned: false, current: false, blocked },
  ],
  balance: 900, games: 5, level: 4, unlockGames: 3, minLevel: 3,
});

describe('character shelf taps (D230)', () => {
  it('wears an owned character and any character when there is no shelf', () => {
    expect(characterTap('char-dozari', shelf(null))).toEqual({ kind: 'wear' });
    expect(characterTap('char-pahlevan', null)).toEqual({ kind: 'wear' });
    expect(characterTap('avatar-03', shelf(null))).toEqual({ kind: 'wear' });
  });
  it('offers to buy a priced character the player can afford', () => {
    expect(characterTap('char-pahlevan', shelf(null))).toEqual({ kind: 'buy', price: 500 });
  });
  it('explains what is missing otherwise', () => {
    for (const b of ['NEEDS_GAMES', 'NEEDS_INVITE', 'NEEDS_LEVEL', 'NEEDS_COINS'] as const) {
      const tap = characterTap('char-pahlevan', shelf(b));
      expect(tap.kind).toBe('blocked');
    }
  });
  it('tags only the characters still to buy', () => {
    expect(characterTag('char-dozari', shelf(null))).toBeNull();
    expect(characterTag('char-pahlevan', shelf(null))).toContain('سکه');
    expect(characterTag('char-pahlevan', null)).toBeNull();
  });
});
