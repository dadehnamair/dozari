import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../items/data.js';
import { DEFAULT_CITIES } from '../cities.js';
import { PROVINCES, provinceOf } from '../provinces.js';

describe('provinces', () => {
  it('has the 31 provinces of Iran plus the abroad entries, with unique keys', () => {
    expect(PROVINCES.filter((p) => !p.abroad)).toHaveLength(31);
    expect(new Set(PROVINCES.map((p) => p.key)).size).toBe(PROVINCES.length);
  });

  it('points every rival and souvenir at something that exists', () => {
    for (const p of PROVINCES) {
      expect(provinceOf(p.rival), p.key).not.toBeNull();
      expect(ITEMS[p.gift], p.key).toBeDefined();
    }
  });

  it('gives every default city a known province, except the Iran-wide «other»', () => {
    for (const c of DEFAULT_CITIES) {
      if (c.slug === 'other') expect(c.province).toBeNull();
      else expect(provinceOf(c.province), c.slug).not.toBeNull();
    }
    expect(new Set(DEFAULT_CITIES.map((c) => c.slug)).size).toBe(DEFAULT_CITIES.length);
  });

  it('covers every Iranian province with at least one city', () => {
    const used = new Set(DEFAULT_CITIES.map((c) => c.province));
    for (const p of PROVINCES) expect(used.has(p.key), p.key).toBe(true);
  });

  it('returns null for unknown or empty keys', () => {
    expect(provinceOf(null)).toBeNull();
    expect(provinceOf('atlantis')).toBeNull();
  });
});
