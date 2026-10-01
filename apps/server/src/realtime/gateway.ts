import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import { ClientEvent, ServerEvent, queueJoinSchema } from '@dozari/shared';
import type { Ack } from '@dozari/shared';
import type { UserRecord } from '../auth/service.js';
import { DuelQueue } from './queue.js';
import { SocketStats } from './stats.js';

export interface GatewayOptions {
  /** Resolves a handshake token to its (not banned) account, else null: `AuthService.authenticate`. */
  authenticate: (token: string) => Promise<UserRecord | null>;
  corsOrigin?: string;
  now?: () => number;
  /** Called when two players are paired. The match service plugs in here; until then pairs are put back in line. */
  onPair?: (a: string, b: string) => Promise<boolean> | boolean;
}

export interface Gateway {
  io: Server;
  stats: SocketStats;
  queue: DuelQueue;
  close(): Promise<void>;
}

const room = (userId: string) => `user:${userId}`;

/** Socket.io entry point: JWT handshake, one room per user, the duel queue. Contract: shared/socket/events.ts. */
export function attachGateway(http: HttpServer, opts: GatewayOptions): Gateway {
  const now = opts.now ?? Date.now;
  const queue = new DuelQueue();
  const stats = new SocketStats({ queueLength: () => queue.length, activeMatches: () => 0, longestWaitMs: (t) => queue.longestWaitMs(t) }, now);
  const io = new Server(http, {
    cors: opts.corsOrigin ? { origin: opts.corsOrigin === '*' ? true : opts.corsOrigin.split(',').map((o) => o.trim()) } : undefined,
  });

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
    const handled = opts.onPair ? await opts.onPair(pair[0], pair[1]) : false;
    if (!handled) for (const id of pair) queue.join(id, now());
  }

  function leaveQueue(userId: string) {
    queue.leave(userId);
  }

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    stats.connected();
    void socket.join(room(userId));

    socket.on(ClientEvent.queueJoin, async (payload: unknown, ack?: (a: Ack) => void) => {
      if (!queueJoinSchema.safeParse(payload).success) return ack?.({ ok: false, error: 'INVALID_PAYLOAD' });
      if (!queue.join(userId, now())) return ack?.({ ok: false, error: 'ALREADY_QUEUED' });
      ack?.({ ok: true });
      socket.emit(ServerEvent.queueStatus, { waitedSec: 0, position: queue.position(userId) ?? 1 });
      await tryPair();
    });

    socket.on(ClientEvent.queueLeave, (_payload: unknown, ack?: (a: Ack) => void) => {
      ack?.(queue.leave(userId) ? { ok: true } : { ok: false, error: 'NOT_QUEUED' });
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
    close: () => new Promise<void>((resolve) => void io.close(() => resolve())),
  };
}
