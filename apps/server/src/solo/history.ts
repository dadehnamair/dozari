/**
 * Which puzzles each player has been served lately (in memory, per process). Used to keep a puzzle from coming back to the same
 * player — in solo, queue duels, private tables and 2v2 alike. Bounded per player and by age; when a pool is exhausted
 * the caller forgets the oldest ones (`forget`) rather than serving nothing.
 */
export class PuzzleHistory {
  private readonly seenBy = new Map<string, { ids: string[]; touchedAt: number }>();

  constructor(
    private readonly perPlayer = 500,
    private readonly ttlMs = 30 * 24 * 60 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Puzzle ids any of these players has already had. */
  seen(userIds: readonly (string | undefined)[]): string[] {
    const out = new Set<string>();
    for (const u of userIds) {
      const e = u ? this.live(u) : undefined;
      if (e) for (const id of e.ids) out.add(id);
    }
    return [...out];
  }

  mark(userIds: readonly (string | undefined)[], puzzleId: string): void {
    for (const u of userIds) {
      if (!u) continue;
      const e = this.live(u) ?? { ids: [], touchedAt: 0 };
      if (!e.ids.includes(puzzleId)) e.ids.push(puzzleId);
      if (e.ids.length > this.perPlayer) e.ids.splice(0, e.ids.length - this.perPlayer);
      e.touchedAt = this.now();
      this.seenBy.set(u, e);
    }
  }

  /** The pool is used up for these players: start over (they have seen everything there is). */
  forget(userIds: readonly (string | undefined)[]): void {
    for (const u of userIds) if (u) this.seenBy.delete(u);
  }

  private live(userId: string) {
    const e = this.seenBy.get(userId);
    if (!e) return undefined;
    if (this.now() - e.touchedAt > this.ttlMs) {
      this.seenBy.delete(userId);
      return undefined;
    }
    return e;
  }
}

/**
 * One pick that avoids what `players` have seen: tries with the exclusion, and if the pool has nothing left,
 * forgets their history and picks again (a small catalog must still play). Marks the result as seen.
 */
export async function pickUnseen<T extends { id: string }>(history: PuzzleHistory | undefined, players: readonly (string | undefined)[], extraExclude: readonly string[], pick: (exclude: readonly string[]) => Promise<T | null>): Promise<T | null> {
  if (!history) return pick(extraExclude);
  const exclude = [...new Set([...history.seen(players), ...extraExclude])];
  let found = await pick(exclude);
  if (!found && exclude.length > extraExclude.length) {
    history.forget(players);
    found = await pick(extraExclude);
  }
  if (found) history.mark(players, found.id);
  return found;
}
