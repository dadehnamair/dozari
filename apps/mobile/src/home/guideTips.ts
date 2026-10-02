/** Which guide tips to offer: those of features that are switched on; `next` cycles and wraps. */
export function availableTips<T extends { key: string }>(tips: readonly T[], off: ReadonlySet<string>): T[] {
  return tips.filter((t) => !off.has(t.key));
}

export const nextTip = (current: number | null, count: number): number | null => (count === 0 ? null : current === null ? 0 : (current + 1) % count);
