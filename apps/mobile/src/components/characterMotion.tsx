import type { ReactNode } from 'react';
import { G } from 'react-native-svg';
import { backArmAngle, blinkScale, bobLift, bobRotate, breathScale, coinFlip, frontArmAngle } from './characterMath';
import { phase } from './sceneMath';
import { useSceneClock } from './sceneMotion';

/**
 * The living cast (docs/design/Character.dc.html `anim`): a gentle head bob, breathing torso, blinking, swinging arms, a flipping hat coin.
 * Each part is a small component on the shared scene clock, so only its own `<G transform>` re-renders; the drawing inside it is the
 * same element objects every frame and React skips it. With `on` false nothing subscribes and the transform is the identity.
 */

const f = (n: number) => n.toFixed(2);

type Part = 'head' | 'body' | 'eyes' | 'coin' | 'armFront' | 'armBack';

interface Props {
  part: Part;
  on: boolean;
  /** Per-character phase offset (seconds, negative = already under way) so a crowd does not move in step. */
  delay?: number;
  /** The pose has raised arms (wave, cheer, win): the arms swing fast. */
  up?: boolean;
  children: ReactNode;
}

export function Motion({ part, on, delay = 0, up = false, children }: Props) {
  const t = useSceneClock(on);
  if (!on) return <G>{children}</G>;
  const at = t + delay;
  switch (part) {
    case 'head': {
      const p = phase(at, 2.6);
      return <G transform={`translate(0 ${f(bobLift(p))}) rotate(${f(bobRotate(p))} 100 148)`}>{children}</G>;
    }
    case 'body': {
      const [sx, sy] = breathScale(phase(at, 2.6));
      return <G transform={`translate(100 222) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(-100 -222)`}>{children}</G>;
    }
    case 'eyes':
      return <G transform={`translate(100 74) scale(1 ${f(blinkScale(phase(t + delay * 3, 3.6)))}) translate(-100 -74)`}>{children}</G>;
    case 'coin':
      return <G transform={`translate(122 42) scale(${f(coinFlip(phase(t, 3)))} 1) translate(-122 -42)`}>{children}</G>;
    case 'armFront':
      return <G transform={`rotate(${f(frontArmAngle(t, up))} 126 155)`}>{children}</G>;
    case 'armBack':
      return <G transform={`rotate(${f(backArmAngle(t, up))} 74 154)`}>{children}</G>;
  }
}
