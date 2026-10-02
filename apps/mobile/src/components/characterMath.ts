/** Pure keyframe math of the character motion (docs/design/Character.dc.html `dzc-*` keyframes), tested in __tests__/characterMath.test.ts. */

const ease = (f: number): number => f * f * (3 - 2 * f); // smoothstep: the CSS `ease-in-out` feel between two keyframes

/** Walks the keyframes `[position 0..1, value]`, eased between each pair; `linear` skips the easing (the design's `linear` timing). */
export function keyframes(frames: readonly (readonly [number, number])[], p: number, linear = false): number {
  for (let i = 0; i < frames.length - 1; i++) {
    const [p0, v0] = frames[i] as readonly [number, number];
    const [p1, v1] = frames[i + 1] as readonly [number, number];
    if (p <= p1) {
      const f = p1 === p0 ? 1 : (p - p0) / (p1 - p0);
      return v0 + (v1 - v0) * (linear ? f : ease(f));
    }
  }
  return (frames[frames.length - 1] as readonly [number, number])[1];
}

/** `dzc-bob` (2.6 s): the head tilts ±3° and lifts up to 2.5 px. */
export const bobRotate = (p: number): number => keyframes([[0, 0], [0.25, -3], [0.5, 0], [0.75, 3], [1, 0]], p);
export const bobLift = (p: number): number => keyframes([[0, 0], [0.25, -1], [0.5, -2.5], [0.75, -1], [1, 0]], p);

/** `dzc-blink` (3.6 s, linear): the eyes shut for a moment near the end of the cycle. */
export const blinkScale = (p: number): number => keyframes([[0, 1], [0.9, 1], [0.94, 0.08], [1, 1]], p, true);

/** `dzc-breath` (2.6 s): the torso swells a little. Returns [x scale, y scale]. */
export function breathScale(p: number): [number, number] {
  const f = keyframes([[0, 0], [0.5, 1], [1, 0]], p);
  return [1 + 0.025 * f, 1 - 0.015 * f];
}

/** `dzc-coin` (3 s): the hat coin flips over once per cycle. */
export const coinFlip = (p: number): number => keyframes([[0, 1], [0.7, 1], [0.8, -1], [0.9, 1], [1, 1]], p, true);

/** An `alternate` animation: 0 → 1 → 0 over `2 × half` seconds. `t` is seconds, `begin` shifts the start. */
export function alternate(t: number, half: number, begin = 0): number {
  const p = ((((t - begin) / (2 * half)) % 1) + 1) % 1;
  return ease(p < 0.5 ? p * 2 : 2 - p * 2);
}

/** Arm swing angles: the front arm swings 0 → −9°, the back arm 0 → 7°; arms that are up (wave, cheer, win) swing fast. */
export const frontArmAngle = (t: number, up: boolean): number => -9 * alternate(t, up ? 0.45 : 1.3);
export const backArmAngle = (t: number, up: boolean): number => 7 * alternate(t, up ? 0.5 : 1.5);
