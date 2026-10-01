/** Live counters of the socket service, shown in the admin panel (`GET /admin/socket`). Pure bookkeeping, no I/O. */
export interface SocketStatsSnapshot {
  startedAt: number;
  uptimeSec: number;
  connections: number;
  peakConnections: number;
  totalConnections: number;
  rejectedHandshakes: number;
  queueLength: number;
  activeMatches: number;
  /** Longest wait among players currently queued, in seconds. */
  longestWaitSec: number;
}

export class SocketStats {
  private connections = 0;
  private peak = 0;
  private total = 0;
  private rejected = 0;

  constructor(
    private readonly probes: { queueLength: () => number; activeMatches: () => number; longestWaitMs: (now: number) => number },
    private readonly now: () => number = Date.now,
    private readonly startedAt: number = now(),
  ) {}

  connected() {
    this.connections += 1;
    this.total += 1;
    this.peak = Math.max(this.peak, this.connections);
  }

  disconnected() {
    this.connections = Math.max(0, this.connections - 1);
  }

  rejectedHandshake() {
    this.rejected += 1;
  }

  snapshot(): SocketStatsSnapshot {
    const now = this.now();
    return {
      startedAt: this.startedAt,
      uptimeSec: Math.floor((now - this.startedAt) / 1000),
      connections: this.connections,
      peakConnections: this.peak,
      totalConnections: this.total,
      rejectedHandshakes: this.rejected,
      queueLength: this.probes.queueLength(),
      activeMatches: this.probes.activeMatches(),
      longestWaitSec: Math.floor(this.probes.longestWaitMs(now) / 1000),
    };
  }
}
