/** FIFO duel queue, one entry per player. Pairing policy (skill bands, bots) comes with MatchmakingService. */
export class DuelQueue {
  private readonly entries = new Map<string, number>();

  join(userId: string, now: number): boolean {
    if (this.entries.has(userId)) return false;
    this.entries.set(userId, now);
    return true;
  }

  leave(userId: string): boolean {
    return this.entries.delete(userId);
  }

  has(userId: string): boolean {
    return this.entries.has(userId);
  }

  get length(): number {
    return this.entries.size;
  }

  /** 1-based place in line, or null when not queued. */
  position(userId: string): number | null {
    let i = 1;
    for (const id of this.entries.keys()) {
      if (id === userId) return i;
      i += 1;
    }
    return null;
  }

  /** Everyone in line with the time they joined, longest waiting first. */
  waiting(): { userId: string; since: number }[] {
    return [...this.entries].map(([userId, since]) => ({ userId, since }));
  }

  waitedMs(userId: string, now: number): number {
    const at = this.entries.get(userId);
    return at === undefined ? 0 : now - at;
  }

  longestWaitMs(now: number): number {
    let longest = 0;
    for (const at of this.entries.values()) longest = Math.max(longest, now - at);
    return longest;
  }

  /** Removes and returns the `n` longest-waiting players (2v2 fill), or null when fewer are queued. */
  takeGroup(n: number): string[] | null {
    if (this.entries.size < n) return null;
    const group = [...this.entries.keys()].slice(0, n);
    for (const id of group) this.entries.delete(id);
    return group;
  }

  /** Removes and returns the two longest-waiting players, or null when fewer than two are queued. */
  takePair(): [string, string] | null {
    if (this.entries.size < 2) return null;
    const it = this.entries.keys();
    const a = it.next().value as string;
    const b = it.next().value as string;
    this.entries.delete(a);
    this.entries.delete(b);
    return [a, b];
  }
}
