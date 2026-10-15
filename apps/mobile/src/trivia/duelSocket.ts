import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { ClientEvent, ServerEvent, ackSchema, queueStatusSchema, tduelEndedSchema, tduelFoundSchema, tduelRefusedSchema, tduelRematchSchema, tduelStateSchema } from '@dozari/shared';
import type { Ack } from '@dozari/shared';
import { session } from '../auth';
import { BASE_URL, callJson } from '../net/http';
import type { TduelAction } from './duelModel';

export interface TriviaDuelConnection {
  /** Enters the search for a rival: a topic id, or nothing for a random mix. */
  join(topicId?: string, mix?: boolean): Promise<Ack>;
  /** Leaves the search, or gives up the running game. */
  leave(): Promise<Ack>;
  answer(index: number): Promise<Ack>;
  /** Asks the same rival for another game (the server starts it when both asked, or at once against a bot). */
  rematch(): Promise<Ack>;
  close(): void;
}

const ask = (socket: Socket, event: string, payload?: unknown): Promise<Ack> =>
  new Promise((resolve) => {
    socket.timeout(8000).emit(event, payload ?? {}, (err: unknown, raw: unknown) => {
      const parsed = err ? null : ackSchema.safeParse(raw);
      resolve(parsed?.success ? parsed.data : { ok: false, error: 'INTERNAL' });
    });
  });

/** Opens the live socket for the question duel with the guest token and turns server events into model actions. */
export async function connectTriviaDuel(dispatch: (a: TduelAction) => void): Promise<TriviaDuelConnection> {
  // Same as the board duel: renew a token the server no longer accepts over HTTP first, so the handshake does not fail as a plain network error.
  const token = await session.authed(async (t) => {
    await callJson('/me', 'GET', undefined, t);
    return t;
  }).catch(() => session.token());
  const socket = io(BASE_URL, { auth: { token }, transports: ['polling', 'websocket'], reconnection: true });

  socket.on(ServerEvent.queueStatus, (p: unknown) => {
    const s = queueStatusSchema.safeParse(p);
    if (s.success) dispatch({ t: 'status', waitedSec: s.data.waitedSec });
  });
  socket.on(ServerEvent.tduelFound, (p: unknown) => {
    const f = tduelFoundSchema.safeParse(p);
    if (f.success) dispatch({ t: 'found', found: f.data });
  });
  socket.on(ServerEvent.tduelState, (p: unknown) => {
    const s = tduelStateSchema.safeParse(p);
    if (s.success) dispatch({ t: 'state', state: s.data });
  });
  socket.on(ServerEvent.tduelEnded, (p: unknown) => {
    const e = tduelEndedSchema.safeParse(p);
    if (e.success) dispatch({ t: 'ended', ended: e.data });
  });
  socket.on(ServerEvent.tduelOffer, (p: unknown) => {
    const o = tduelRematchSchema.safeParse(p);
    if (o.success) dispatch({ t: 'offer', state: o.data.state });
  });
  socket.on(ServerEvent.tduelRefused, (p: unknown) => {
    const r = tduelRefusedSchema.safeParse(p);
    if (r.success) dispatch({ t: 'refused', error: r.data.error });
  });
  socket.on('connect_error', () => dispatch({ t: 'error', error: 'NETWORK' }));

  await new Promise<void>((resolve) => {
    if (socket.connected) resolve();
    else socket.once('connect', () => resolve());
    setTimeout(resolve, 8000);
  });

  return {
    join: (topicId, mix) => ask(socket, ClientEvent.tduelJoin, mix ? { mix: true } : topicId ? { topicId } : {}),
    leave: () => ask(socket, ClientEvent.tduelLeave),
    answer: (index) => ask(socket, ClientEvent.tduelAnswer, { index }),
    rematch: () => ask(socket, ClientEvent.tduelRematch),
    close: () => {
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}
