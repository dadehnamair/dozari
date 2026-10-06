import { describe, expect, it } from 'vitest';
import { ITEM_GROUPS, ITEMS, ITEM_ICON_KEYS, SAMPLE_ICONS, itemSvg } from '../index.js';

/** Characters a path of the 64-grid pack may contain: commands, numbers, separators. */
const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/;
const COLOUR = /^#[0-9A-Fa-f]{3,8}$/;

describe('icon pack', () => {
  it('draws every icon from valid parts', () => {
    for (const [key, icon] of Object.entries(ITEMS)) {
      expect(icon.p.length, key).toBeGreaterThan(0);
      for (const part of icon.p) {
        const [d, fill, a, b] = part;
        expect(PATH.test(d), `${key}: path ${d.slice(0, 40)}`).toBe(true);
        expect(d.includes('NaN') || d.includes('undefined'), key).toBe(false);
        if (fill === 'L') {
          expect(typeof a, `${key}: line width`).toBe('number');
          if (b !== undefined) expect(COLOUR.test(b), `${key}: line colour ${b}`).toBe(true);
        } else if (fill !== 'H') {
          expect(COLOUR.test(fill), `${key}: fill ${fill}`).toBe(true);
        }
      }
    }
  });

  it('puts every icon in exactly one category, with a Persian name', () => {
    const seen = new Map<string, number>();
    for (const g of ITEM_GROUPS) for (const i of g.icons) seen.set(i.key, (seen.get(i.key) ?? 0) + 1);
    expect(ITEM_ICON_KEYS.filter((k) => !seen.has(k))).toEqual([]);
    expect([...seen].filter(([, n]) => n > 1)).toEqual([]);
    for (const g of ITEM_GROUPS) for (const i of g.icons) expect(i.fa.length, i.key).toBeGreaterThan(0);
  });

  it('maps every sample product to an icon that exists', () => {
    expect(Object.values(SAMPLE_ICONS).filter((k) => !(k in ITEMS))).toEqual([]);
  });
});

describe('itemSvg', () => {
  it('draws a standalone svg for every icon and falls back to the coin', () => {
    for (const key of ITEM_ICON_KEYS) expect(itemSvg(key), key).toMatch(/^<svg [^>]*>.*<\/svg>$/);
    expect(itemSvg('no-such-icon')).toBe(itemSvg('coin'));
  });
});
