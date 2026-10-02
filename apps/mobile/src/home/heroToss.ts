/** Geometry of the hero's coin toss: where the raised hand is inside the hero box (pure, tested). */

/** The character's viewBox (full body) and the raised front hand of the `wave` pose (character-data `upR`). */
const VIEW = { x: -20, y: -18, w: 240, h: 276 };
const HAND = { x: 152, y: 102 };

/** The hand's position in px inside a `width × height` box that draws the character with `meet` scaling (centred). */
export function handPosition(width: number, height: number): { x: number; y: number; scale: number } {
  const scale = Math.min(width / VIEW.w, height / VIEW.h);
  const offX = (width - VIEW.w * scale) / 2;
  const offY = (height - VIEW.h * scale) / 2;
  return { x: offX + (HAND.x - VIEW.x) * scale, y: offY + (HAND.y - VIEW.y) * scale, scale };
}
