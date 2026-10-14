/**
 * The last coin balance Home drew. Home unmounts while a match is played and mounts again afterwards, so the
 * balance it shows next is compared with this to find what the match won or cost.
 */
let lastSeen: number | null = null;

export const lastSeenBalance = (): number | null => lastSeen;
export const rememberBalance = (n: number): void => {
  lastSeen = n;
};
/** Test hook. */
export const resetSeenBalance = (): void => {
  lastSeen = null;
};

/** Change since the balance was last drawn; 0 on the very first draw (nothing to compare with). */
export function coinDelta(prev: number | null, next: number): number {
  return prev === null ? 0 : next - prev;
}
