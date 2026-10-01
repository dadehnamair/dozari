import { describe, expect, it } from 'vitest';
import { candyTone, colors, groupShelf, shelfOf } from '../colors';
import { ICON_PATHS } from '../icons';

describe('theme', () => {
  it('keeps the candy base colours in sync with the tone table', () => {
    for (const [name, base] of Object.entries(colors.candy)) {
      expect(candyTone[name as keyof typeof candyTone].base).toBe(base);
    }
  });

  it('gives each locked group colour a shelf', () => {
    expect(groupShelf).toHaveLength(colors.group.length);
  });

  it('looks up the dark shelf of a candy colour, with a neutral fallback', () => {
    expect(shelfOf(colors.candy.pink)).toBe(candyTone.pink.dark);
    expect(shelfOf('#123456')).toBe('rgba(0,0,0,0.28)');
  });

  it('has a non-empty path for every icon', () => {
    const names = Object.keys(ICON_PATHS);
    expect(names.length).toBeGreaterThanOrEqual(40);
    for (const d of Object.values(ICON_PATHS)) expect(d).toMatch(/^M/);
  });
});
