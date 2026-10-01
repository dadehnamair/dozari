import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import { ClientEvent, ServerEvent, matchResumeSchema, matchSubmitSchema, queueJoinSchema } from '@dozari/shared';
import type { Ack } from '@dozari/shared';
import type { UserRecord } from '../auth/service.js';
import { RateLimiter } from '../security/rate-limit.js';
import { MatchService } from './match-service.js';
import type { MatchDeps } from './match-service.js';
import { DuelQueue } from './queue.js';
import { SocketStats } from './stats.js';

export interface GatewayOptions {
  /** Resolves a handshake token to its (not banned) account, else null: `AuthService.authenticate`. */
  authenticate: (token: string) => Promise<UserRecord | null>;
  corsOrigin?: string;
  now?: () => number;
  /** Called when two players are paired; return false to put them back in line. Ignored when `match` is given. */
  onPair?: (a: string, b: string) => Promise<boolean> | boolean;
  /** Live matches: everything but `emit` (the gateway supplies it). When set, pairs are handed to a `MatchService`. */
  match?: Omit<MatchDeps, 'emit'>;
}

export interface Gateway {
  io: Server;
  stats: SocketStats;
  queue: DuelQueue;
  matches?: MatchService;
  close(): Promise<void>;
}

const room = (userId: string) => `user:${userId}`;

/** Socket.io entry point: JWT handshake, one room per user, the duel queue. Contract: shared/socket/events.ts. */
export function attachGateway(http: HttpServer, opts: GatewayOptions): Gateway {
  const now = opts.now ?? Date.now;
  const queue = new DuelQueue();
  let matches: MatchService | undefined;
  const stats = new SocketStats({ queueLength: () => queue.length, activeMatches: () => matches?.activeCount ?? 0, longestWaitMs: (t) => queue.longestWaitMs(t) }, now);
  const io = new Server(http, {
    // Every client message is a tiny JSON object.
    maxHttpBufferSize: 16 * 1024,
    cors: opts.corsOrigin ? { origin: opts.corsOrigin === '*' ? true : opts.corsOrigin.split(',').map((o) => o.trim()) } : undefined,
  });
  if (opts.match) matches = new MatchService({ now, ...opts.match, emit: (userId, event, payload) => void io.to(room(userId)).emit(event, payload) });

  io.use(async (socket, next) => {
    const token: unknown = socket.handshake.auth?.token;
    const user = typeof token === 'string' ? await opts.authenticate(token) : null;
    if (!user) {
      stats.rejectedHandshake();
      return next(new Error('UNAUTHORIZED'));
    }
    socket.data.userId = user.id;
    next();
  });

  async function tryPair() {
    const pair = queue.takePair();
    if (!pair) return;
    const handled = matches ? await matches.start(pair[0], pair[1]) : opts.onPair ? await opts.onPair(pair[0], pair[1]) : false;
    if (!handled) for (const id of pair) queue.join(id, now());
  }

  function leaveQueue(userId: string) {
    queue.leave(userId);
  }

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    stats.connected();
    // A flooding client is cut off: 60 events per 10 seconds per connection.
    const flood = new RateLimiter(60, 10_000, now);
    socket.use((_packet, next) => {
      if (flood.take(socket.id)) return next();
      socket.disconnect(true);
    });
    void socket.join(room(userId));

    socket.on(ClientEvent.queueJoin, async (payload: unknown, ack?: (a: Ack) => void) => {
      if (!queueJoinSchema.safeParse(payload).success) return ack?.({ ok: false, error: 'INVALID_PAYLOAD' });
      if (matches?.inMatch(userId)) return ack?.({ ok: false, error: 'ALREADY_IN_MATCH' });
      if (!queue.join(userId, now())) return ack?.({ ok: false, error: 'ALREADY_QUEUED' });
      ack?.({ ok: true });
      socket.emit(ServerEvent.queueStatus, { waitedSec: 0, position: queue.position(userId) ?? 1 });
      await tryPair();
    });

    socket.on(ClientEvent.queueLeave, (_payload: unknown, ack?: (a: Ack) => void) => {
      ack?.(queue.leave(userId) ? { ok: true } : { ok: false, error: 'NOT_QUEUED' });
    });

    // A returning player gets the live board straight away.
    matches?.resume(userId);

    socket.on(ClientEvent.matchSubmit, (payload: unknown, ack?: (a: Ack) => void) => {
      const body = matchSubmitSchema.safeParse(payload);
      if (!body.success) return ack?.({ ok: false, error: 'INVALID_PAYLOAD' });
      ack?.(matches ? matches.submit(userId, body.data.itemIds) : { ok: false, error: 'NOT_IN_MATCH' });
    });

    socket.on(ClientEvent.matchResume, (payload: unknown, ack?: (a: Ack) => void) => {
      const body = matchResumeSchema.safeParse(payload);
      if (!body.success) return ack?.({ ok: false, error: 'INVALID_PAYLOAD' });
      ack?.(matches ? matches.resume(userId, body.data.matchId) : { ok: false, error: 'NOT_IN_MATCH' });
    });

    socket.on(ClientEvent.matchLeave, (_payload: unknown, ack?: (a: Ack) => void) => {
      ack?.(matches ? matches.leave(userId) : { ok: false, error: 'NOT_IN_MATCH' });
    });

    socket.on('disconnect', async () => {
      stats.disconnected();
      // Leave the line only when this was the player's last open connection.
      const left = await io.in(room(userId)).fetchSockets();
      if (left.length === 0) leaveQueue(userId);
    });
  });

  return {
    io,
    stats,
    queue,
    matches,
    close: () => new Promise<void>((resolve) => void io.close(() => resolve())),
  };
}
