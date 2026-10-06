import type { AgeTrack } from '@dozari/shared';

export type QueueTier = 'bronze' | 'silver' | 'gold';

/**
 * FIFO duel queue, one entry per player. Each entry carries its age track and stake tier; only same-track, same-tier players are ever paired
 * (docs/logic/age-tracks.md): a kid can never be matched with an adult by a bug elsewhere. Other pairing policy comes with MatchmakingService.
 */
export class DuelQueue {
  private readonly entries = new Map<string, { since: number; track: AgeTrack; tier: QueueTier }>();

  join(userId: string, now: number, track: AgeTrack = 'adult', tier: QueueTier = 'bronze'): boolean {
    if (this.entries.has(userId)) return false;
    this.entries.set(userId, { since: now, track, tier });
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
  waiting(): { userId: string; since: number; track: AgeTrack; tier: QueueTier }[] {
    return [...this.entries].map(([userId, e]) => ({ userId, since: e.since, track: e.track, tier: e.tier }));
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

  /** Removes and returns the `n` longest-waiting players of one track and tier (2v2 fill), or null when no bucket has `n` waiting. */
  takeGroup(n: number): string[] | null {
    return this.takeGroupWithTier(n)?.ids ?? null;
  }

  /** Same as `takeGroup`, also telling which stake tier the group queued for. */
  takeGroupWithTier(n: number): { ids: string[]; tier: QueueTier } | null {
    const buckets = new Map<string, { ids: string[]; tier: QueueTier }>();
    for (const [id, e] of this.entries) {
      const key = `${e.track}|${e.tier}`;
      const b = buckets.get(key) ?? { ids: [], tier: e.tier };
      b.ids.push(id);
      buckets.set(key, b);
    }
    // The bucket whose first player has waited longest wins; Map keeps the order of first insertion.
    for (const b of buckets.values()) {
      if (b.ids.length < n) continue;
      const ids = b.ids.slice(0, n);
      for (const id of ids) this.entries.delete(id);
      return { ids, tier: b.tier };
    }
    return null;
  }

  /** Removes and returns the two longest-waiting players of one track and tier, or null when no bucket has two waiting. */
  takePair(): [string, string] | null {
    const group = this.takeGroup(2);
    return group ? [group[0]!, group[1]!] : null;
  }

  takePairWithTier(): { pair: [string, string]; tier: QueueTier } | null {
    const g = this.takeGroupWithTier(2);
    return g ? { pair: [g.ids[0]!, g.ids[1]!], tier: g.tier } : null;
  }
}
