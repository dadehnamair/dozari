/** The scanning highlight hops over the 4x4 grid: 5-11 cells further each tick (as in the design kit). */
export const SEARCH_CELLS = 16;

/** `r` is a random number in [0, 1); injected so the step is testable. */
export function nextScan(scan: number, r: number): number {
  return (scan + 5 + Math.floor(r * 7)) % SEARCH_CELLS;
}

/** Level shown on a player card: 3..30 spread over the grid, stable per cell. */
export function cellLevel(index: number): number {
  return 3 + ((index * 7) % 28);
}

/** `m:ss` for a real wait of `sec` seconds (the duel queue reports it). */
export function waitClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** `m:ss` clock for how long the search has run, one tick every `tickMs`. */
export function searchClock(ticks: number, tickMs = 450): string {
  const seconds = Math.floor((ticks * tickMs) / 1000) % 60;
  return `0:${String(seconds).padStart(2, '0')}`;
}

/** One card of the search grid. `avatarKey` is null for a placeholder (nobody to show yet). */
export interface Face {
  name: string;
  level: number;
  avatarKey: string | null;
}

/**
 * The 16 cards of the grid. Real faces (online players, topped up with bots by the server) repeat around the grid when
 * there are fewer than 16; with none at all the design's placeholder names fill it.
 */
export function facesFor(candidates: readonly { nickname: string; avatarKey: string; level: number }[], placeholders: readonly string[]): Face[] {
  return Array.from({ length: SEARCH_CELLS }, (_, i) => {
    const c = candidates.length > 0 ? candidates[i % candidates.length] : undefined;
    return c ? { name: c.nickname, level: c.level, avatarKey: c.avatarKey } : { name: placeholders[i] ?? '', level: cellLevel(i), avatarKey: null };
  });
}
