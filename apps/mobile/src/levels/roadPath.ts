/** Geometry of the winding level road (docs/design/Dozari - 17 Chat Shop Unlocks.dc.html, screen-levels). Pure, tested in __tests__/roadPath.test.ts. */

export interface RoadPoint {
  level: number;
  x: number;
  y: number;
  /** The node sits on the left bend, so its cards go to the right (and the other way round). */
  left: boolean;
}

export interface RoadLayout {
  points: RoadPoint[];
  /** Total height of the road canvas. */
  height: number;
  /** The whole road, level 1 at the bottom up to the top level. */
  pathD: string;
  /** The stretch already travelled: level 1 up to `upTo`. */
  doneD: (upTo: number) => string;
}

export const ROAD_STEP = 108;
const PAD_TOP = 60;
const PAD_BOTTOM = 110;
/** The bends sit at these fractions of the width (96 and 222 of the design's 318). */
export const LEFT_AT = 0.3;
export const RIGHT_AT = 0.7;

/** Level 1 at the bottom, bends alternating left / right, joined by S-shaped Béziers like the design's `seg`. */
export function roadLayout(levelMax: number, width: number, step = ROAD_STEP): RoadLayout {
  const height = PAD_TOP + (levelMax - 1) * step + PAD_BOTTOM;
  const points: RoadPoint[] = Array.from({ length: levelMax }, (_, i) => {
    const left = i % 2 === 0;
    return { level: i + 1, x: Math.round(width * (left ? LEFT_AT : RIGHT_AT)), y: height - PAD_BOTTOM - i * step, left };
  });
  const seg = (pts: RoadPoint[]): string =>
    pts.reduce((d, p, i) => {
      if (i === 0) return `M${p.x} ${p.y + 56} L${p.x} ${p.y}`;
      const q = pts[i - 1]!;
      return `${d} C${q.x} ${q.y - step * 0.55} ${p.x} ${p.y + step * 0.55} ${p.x} ${p.y}`;
    }, '');
  const last = points[points.length - 1]!;
  return {
    points,
    height,
    pathD: `${seg(points)} L${last.x} ${last.y - 50}`,
    doneD: (upTo) => seg(points.slice(0, Math.max(1, Math.min(levelMax, upTo)))),
  };
}

/** Decorative dots of the night sky: a fixed scatter so the sky does not jump between renders. */
export function skyStars(width: number, height: number, count = 28): { x: number; y: number; r: number; o: number }[] {
  return Array.from({ length: count }, (_, i) => ({ x: (i * 73) % Math.max(1, width - 12) + 6, y: (i * 197) % Math.max(1, height - 20) + 10, r: (i % 3) + 2, o: 0.25 + (i % 4) * 0.12 }));
}
