import type { AgeTrack } from '@dozari/shared';

/**
 * FIFO duel queue, one entry per player. Each entry carries its age track and only same-track players are ever paired
 * (docs/logic/age-tracks.md): a kid can never be matched with an adult by a bug elsewhere. Other pairing policy comes with MatchmakingService.
 */
export class DuelQueue {
  private readonly entries = new Map<string, { since: number; track: AgeTrack }>();

  join(userId: string, now: number, track: AgeTrack = 'adult'): boolean {
    if (this.entries.has(userId)) return false;
    this.entries.set(userId, { since: now, track });
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
  waiting(): { userId: string; since: number; track: AgeTrack }[] {
    return [...this.entries].map(([userId, e]) => ({ userId, since: e.since, track: e.track }));
  }

  waitedMs(userId: string, now: number): number {
    const at = this.entries.get(userId)?.since;
    return at === undefined ? 0 : now - at;
  }

  longestWaitMs(now: number): number {
    let longest = 0;
    for (const { since } of this.entries.values()) longest = Math.max(longest, now - since);
    return longest;
  }

  /** Removes and returns the `n` longest-waiting players of one track (2v2 fill), or null when no track has `n` waiting. */
  takeGroup(n: number): string[] | null {
    const buckets = new Map<AgeTrack, string[]>();
    for (const [id, e] of this.entries) {
      const list = buckets.get(e.track) ?? [];
      list.push(id);
      buckets.set(e.track, list);
    }
    // The bucket whose first player has waited longest wins; Map keeps the order of first insertion.
    for (const list of buckets.values()) {
      if (list.length < n) continue;
      const group = list.slice(0, n);
      for (const id of group) this.entries.delete(id);
      return group;
    }
    return null;
  }

  /** Removes and returns the two longest-waiting players of one track, or null when no track has two waiting. */
  takePair(): [string, string] | null {
    const group = this.takeGroup(2);
    return group ? [group[0]!, group[1]!] : null;
  }
}
