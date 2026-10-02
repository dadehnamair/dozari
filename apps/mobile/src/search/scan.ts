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
