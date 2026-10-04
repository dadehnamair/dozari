/** Fixed-window counter per key, in memory (one server process). Cheap enough to sit on every request. */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = 0;

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Counts one hit; returns false when `key` is over the limit for this window. */
  take(key: string): boolean {
    const t = this.now();
    this.sweep(t);
    const cur = this.hits.get(key);
    if (!cur || cur.resetAt <= t) {
      this.hits.set(key, { count: 1, resetAt: t + this.windowMs });
      return true;
    }
    cur.count += 1;
    return cur.count <= this.max;
  }

  /** True when `key` has already used up its hits (without counting a new one). */
  blocked(key: string): boolean {
    const cur = this.hits.get(key);
    return !!cur && cur.resetAt > this.now() && cur.count >= this.max;
  }

  /** Seconds until the key may try again (for `Retry-After`). */
  retryAfterSec(key: string): number {
    const cur = this.hits.get(key);
    return cur ? Math.max(1, Math.ceil((cur.resetAt - this.now()) / 1000)) : 1;
  }

  private sweep(t: number) {
    if (t - this.lastSweep < this.windowMs) return;
    this.lastSweep = t;
    for (const [k, v] of this.hits) if (v.resetAt <= t) this.hits.delete(k);
  }
}
