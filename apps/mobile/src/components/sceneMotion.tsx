import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Circle, Ellipse, G, Path } from 'react-native-svg';
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

/** The vault wheel of the adult «صرافی» scene: turns 0 → 14° and back about (`x`, `y`) every `dur` seconds, eased. */
export function Turn({ x, y, deg, dur, animated, children }: { x: number; y: number; deg: number; dur: number; animated: boolean; children: ReactNode }) {
  const t = useSceneClock(animated);
  const angle = animated ? deg * (0.5 - 0.5 * Math.cos(2 * Math.PI * phase(t, dur))) : 0;
  return <G transform={`rotate(${angle.toFixed(2)} ${x} ${y})`}>{children}</G>;
}

/** A slow lamp-light breathe: the glow circle's opacity goes 1 → .75 → 1 every `dur` seconds. */
export function Breathe({ cy, r, dur, fill, animated }: { cy: number; r: number; dur: number; fill: string; animated: boolean }) {
  const t = useSceneClock(animated);
  return <Circle cy={cy} r={r} fill={fill} stroke="none" opacity={animated ? across([1, 0.75, 1], phase(t, dur)) : 1} />;
}

/** A music note rising from the instrument: drifts by (`dx`, `dy`) and fades in and out every 3.4 s (`begin` offsets the second note). */
function Note({ dx, dy, begin, animated, children }: { dx: number; dy: number; begin: number; animated: boolean; children: ReactNode }) {
  const t = useSceneClock(animated);
  const p = phase(t, 3.4, begin);
  return (
    <G transform={animated ? `translate(${(dx * p).toFixed(1)} ${(dy * p).toFixed(1)})` : undefined} opacity={animated ? across([0, 0.9, 0], p) : 0.9}>
      {children}
    </G>
  );
}

/** The player's tapping hand: up 1.6 and back every 0.6 s. */
function Tap({ animated, children }: { animated: boolean; children: ReactNode }) {
  const t = useSceneClock(animated);
  const y = animated ? across([0, -1.6, 0], phase(t, 0.6)) : 0;
  return <G transform={`translate(0 ${y.toFixed(2)})`}>{children}</G>;
}

/**
 * The musician on the bazaar rug (docs/design/Scene.dc.html): a seated player with a round-bellied instrument, a tapping hand
 * and two notes floating up. Drawn at the design's coordinates (the group is moved by `translate(43 9)` there).
 */
export function Musician({ animated }: { animated: boolean }) {
  return (
    <G transform="translate(43 9)">
      <G strokeWidth={1.3}>
        <Ellipse cx={226} cy={649} rx={15} ry={3} fill="#A33A2A" />
        <Path d="M214 649 C213 637 218 629 226 629 C234 629 239 637 238 649Z" fill="#5A6FA8" />
        <Path d="M212 649 C214 643 222 642 228 645 C234 642 240 644 240 649Z" fill="#46568A" />
        <Circle cx={226} cy={622} r={6} fill="#E8B48A" />
        <Path d="M220 620 C220 612 232 612 232 620Z" fill="#3A2418" />
        <Path d="M221 625 q5 4 10 0" fill="#3A2418" stroke="none" />
        <Path d="M227 637 L210 621" strokeWidth={2.2} fill="none" />
        <Path d="M207 618 l4 -1 l2 4 l-4 1Z" fill="#8A4E22" />
        <Ellipse cx={230} cy={640} rx={5} ry={4.2} fill="#B8743E" />
        <Ellipse cx={226.5} cy={635.5} rx={3.4} ry={3} fill="#C98A4E" />
        <Circle cx={230} cy={640} r={2} fill="#F2E2C2" stroke="none" />
        <Tap animated={animated}>
          <Circle cx={234} cy={638} r={2.4} fill="#E8B48A" />
        </Tap>
        <Circle cx={216} cy={627} r={2.2} fill="#E8B48A" />
        <G fill="#FFF6E8" stroke="#4A2E1E" strokeWidth={1}>
          <Note dx={-6} dy={-26} begin={0} animated={animated}>
            <Path d="M238 616 v-7 l4 -1 v6" fill="none" />
            <Ellipse cx={236.6} cy={616.4} rx={2} ry={1.5} />
          </Note>
          <Note dx={4} dy={-24} begin={-1.7} animated={animated}>
            <Path d="M222 610 v-7" fill="none" />
            <Ellipse cx={220.6} cy={610.4} rx={2} ry={1.5} />
          </Note>
        </G>
      </G>
    </G>
  );
}
