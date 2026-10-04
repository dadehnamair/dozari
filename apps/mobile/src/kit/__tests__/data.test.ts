import { describe, expect, it } from 'vitest';
import { fa } from '../../i18n/fa';
import { ICON_PATHS } from '../../theme/icons';
import { AVATARS, BANNERS, EMPTY_STATES, PORTALS, STAMPS, TAGS, TIERS } from '../data';
import { confettiPieces, rainDrops, rnd } from '../../components/fx';

describe('kit data', () => {
  it('has 24 distinct avatars with sequential keys', () => {
    expect(AVATARS).toHaveLength(24);
    expect(new Set(AVATARS.map((a) => a.key)).size).toBe(24);
    expect(AVATARS[0]?.key).toBe('avatar-01');
    expect(AVATARS[23]?.key).toBe('avatar-24');
    for (const a of AVATARS) expect(a.skin).toBeGreaterThanOrEqual(0);
  });

  it('has five tiers with a Persian name each', () => {
    expect(TIERS.map((t) => t.tier)).toEqual([1, 2, 3, 4, 5]);
    expect(fa.kit.tiers).toHaveLength(TIERS.length);
  });

  it('labels every tag, portal, banner and empty state', () => {
    for (const t of TAGS) {
      expect(fa.kit.tags[t.key]).toBeTruthy();
      expect(ICON_PATHS[t.icon]).toBeTruthy();
    }
    for (const p of PORTALS) {
      expect(fa.kit.portals[p.key]).toBeTruthy();
      expect(ICON_PATHS[p.icon]).toBeTruthy();
    }
    for (const b of BANNERS) expect(fa.kit.banners[b.kind]).toBeTruthy();
    for (const e of EMPTY_STATES) {
      const text = fa.kit.empty[e.kind];
      expect(text.title).toBeTruthy();
      expect(Boolean(text.action)).toBe(e.hasAction);
    }
  });

  it('has the six decade stamps', () => {
    expect(STAMPS.map((s) => s.decade)).toEqual(['50', '60', '70', '80', '90', '00']);
  });
});

describe('fx layouts', () => {
  it('is deterministic', () => {
    expect(rnd(0, 1, 5)).toBe(rnd(0, 1, 5));
    expect(rainDrops(34)).toEqual(rainDrops(34));
  });

  it('keeps particles inside their ranges', () => {
    expect(confettiPieces()).toHaveLength(12);
    for (const d of rainDrops()) {
      expect(d.phase).toBeGreaterThanOrEqual(0);
      expect(d.phase).toBeLessThan(1);
      expect(d.height).toBeGreaterThan(0);
    }
  });
});
