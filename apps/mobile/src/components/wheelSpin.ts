/**
 * The vault wheel of the adult scene (docs/design/adult/): the player can turn it by hand and let go, and it keeps spinning,
 * the faster the harder it was flicked, until friction stops it. One shared state, so the wheel keeps its angle across screens.
 */

const FRICTION = 0.9; // per second: velocity × e^(−FRICTION·t)
const MAX_SPEED = 2400; // degrees per second
const REST = 3; // below this the wheel is considered stopped

let rot = 0;
let vel = 0;
let dragging = false;
let frame: ReturnType<typeof requestAnimationFrame> | null = null;
let last = 0;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

/** The angle the player has turned the wheel to, in degrees (the scene adds its own gentle sway on top). */
export const wheelRotation = (): number => rot;

export function subscribeWheel(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!dragging) {
    rot += vel * dt;
    vel *= Math.exp(-FRICTION * dt);
    if (Math.abs(vel) < REST) vel = 0;
    notify();
  }
  frame = !dragging && vel === 0 ? null : requestAnimationFrame(loop);
}

/** A finger lands on the wheel: it stops under it. */
export function grabWheel(): void {
  dragging = true;
  vel = 0;
  if (frame !== null) {
    cancelAnimationFrame(frame);
    frame = null;
  }
}

/** The finger turned the wheel by `deg` degrees in `dtSec` seconds. */
export function dragWheel(deg: number, dtSec: number): void {
  rot += deg;
  if (dtSec > 0) {
    const v = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, deg / dtSec));
    vel = vel * 0.4 + v * 0.6; // smoothed, so one jittery frame does not decide the fling
  }
  notify();
}

/** The finger lifts: the wheel keeps its speed (none when `inertia` is off, e.g. reduced motion). */
export function releaseWheel(inertia: boolean): void {
  dragging = false;
  if (!inertia || Math.abs(vel) < REST) {
    vel = 0;
    return;
  }
  vel = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, vel * 1.25));
  last = Date.now();
  frame = requestAnimationFrame((t) => ((last = t), (frame = requestAnimationFrame(loop))));
}
