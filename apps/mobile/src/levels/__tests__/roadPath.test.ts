import { describe, expect, it } from 'vitest';
import { LEFT_AT, RIGHT_AT, ROAD_STEP, roadLayout, skyStars } from '../roadPath';

describe('winding road layout', () => {
  const w = 320;
  const lay = roadLayout(6, w);

  it('puts level 1 at the bottom and zig-zags up, left bend first', () => {
    expect(lay.points.map((p) => p.level)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(lay.points.map((p) => p.left)).toEqual([true, false, true, false, true, false]);
    expect(lay.points[0]!.x).toBe(Math.round(w * LEFT_AT));
    expect(lay.points[1]!.x).toBe(Math.round(w * RIGHT_AT));
    for (let i = 1; i < 6; i++) expect(lay.points[i - 1]!.y - lay.points[i]!.y).toBe(ROAD_STEP);
    expect(lay.points[0]!.y).toBeLessThan(lay.height);
    expect(lay.points[5]!.y).toBeGreaterThan(0);
  });

  it('draws one S-curve per step and a done stretch that stops at the current level', () => {
    expect(lay.pathD.startsWith('M')).toBe(true);
    expect((lay.pathD.match(/C/g) ?? []).length).toBe(5);
    expect((lay.doneD(3).match(/C/g) ?? []).length).toBe(2);
    expect((lay.doneD(1).match(/C/g) ?? []).length).toBe(0);
    expect(lay.doneD(99)).toBe(lay.doneD(6));
  });

  it('scatters stars inside the canvas', () => {
    for (const s of skyStars(w, lay.height)) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(w);
      expect(s.y).toBeLessThanOrEqual(lay.height);
    }
  });
});
