import { mulberry32 } from '../game/index.js';

/** FNV-1a: a stable 32-bit seed from the Tehran date key, so every player (and every server) sees the same day. */
function seedOf(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Which rotating shop items are on offer on one Tehran day (docs/logic/economy-v2.md, daily rotating shop): a deterministic pick of
 * `slots` ids out of the pool, in the pool's own order. `slots <= 0` or a pool no bigger than `slots` offers everything.
 */
export function pickDailyShop(poolIds: readonly string[], dateKey: string, slots: number): string[] {
  if (slots <= 0 || poolIds.length <= slots) return [...poolIds];
  const rng = mulberry32(seedOf(dateKey));
  const order = [...poolIds].sort();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const chosen = new Set(order.slice(0, slots));
  return poolIds.filter((id) => chosen.has(id));
}
