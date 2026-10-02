import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Circle, G } from 'react-native-svg';
import { across, phase } from './sceneMath';

/**
 * The motion of the painted scenes (docs/design/Scene.dc.html): clouds drifting across, lantern glows pulsing, a palm swaying.
 * The design animates with SMIL; here one shared clock (about 15 frames a second) drives small components, so only the moving
 * parts re-render and the rest of the scene stays still. Everything stands still when `animated` is false (reduce-motion).
 */

const FRAME_MS = 66;
const listeners = new Set<(t: number) => void>();
let timer: ReturnType<typeof setInterval> | null = null;
const startedAt = Date.now();

function subscribe(fn: (t: number) => void): () => void {
  listeners.add(fn);
  if (!timer) {
    timer = setInterval(() => {
      const t = (Date.now() - startedAt) / 1000;
      listeners.forEach((l) => l(t));
    }, FRAME_MS);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Seconds since the app started, ticking while `on`; 0 and no timer otherwise. */
export function useSceneClock(on: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => (on ? subscribe(setT) : undefined), [on]);
  return on ? t : 0;
}

/** A cloud (or anything) drifting along x from `from` to `to`, looping every `dur` seconds. */
export function Drift({ from, to, dur, begin, animated, children }: { from: number; to: number; dur: number; begin: number; animated: boolean; children: ReactNode }) {
  const t = useSceneClock(animated);
  const x = animated ? from + (to - from) * phase(t, dur, begin) : 0;
  return <G transform={`translate(${x.toFixed(1)} 0)`}>{children}</G>;
}

/** The soft glow of a hanging lantern: opacity and radius flicker through the design's keyframes. */
export function Glow({ cy = 16, r, radii, dur, fill, animated }: { cy?: number; r: number; radii: readonly number[]; dur: number; fill: string; animated: boolean }) {
  const t = useSceneClock(animated);
  const p = phase(t, dur);
  return <Circle cy={cy} r={animated ? across(radii, p) : r} fill={fill} stroke="none" opacity={animated ? across([1, 0.55, 0.9, 0.6, 1], p) : 1} />;
}

/** A gentle sway about (`x`, `y`): −2° to 2.5° and back every `dur` seconds, eased. */
export function Sway({ x, y, dur, animated, children }: { x: number; y: number; dur: number; animated: boolean; children: ReactNode }) {
  const t = useSceneClock(animated);
  const angle = animated ? -2 + 4.5 * (0.5 - 0.5 * Math.cos(2 * Math.PI * phase(t, dur))) : 0;
  return <G transform={`rotate(${angle.toFixed(2)} ${x} ${y})`}>{children}</G>;
}
