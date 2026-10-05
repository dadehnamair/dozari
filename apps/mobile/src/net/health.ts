/**
 * Whether the server is answering. `callJson` reports every call here; two failed calls in a row (no connection, or a
 * 502/503/504 from the proxy) mark the server as down, and one good answer clears it. The app shows a calm banner meanwhile.
 */
const FAILS_TO_DOWN = 2;

let fails = 0;
let down = false;
const listeners = new Set<(down: boolean) => void>();

export function reportServer(ok: boolean): void {
  fails = ok ? 0 : fails + 1;
  const now = fails >= FAILS_TO_DOWN;
  if (now === down) return;
  down = now;
  listeners.forEach((l) => l(down));
}

export const isServerDown = (): boolean => down;

export function onServerDown(listener: (down: boolean) => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** For tests. */
export function resetServerHealth(): void {
  fails = 0;
  down = false;
  listeners.clear();
}
