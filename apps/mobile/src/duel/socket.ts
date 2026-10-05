import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { ClientEvent, ServerEvent, ackSchema, chatMessageSchema, matchEndedSchema, matchEventSchema, matchFoundSchema, matchViewSchema, queueStatusSchema } from '@dozari/shared';
import type { Ack } from '@dozari/shared';
import { session } from '../auth';
import { BASE_URL, callJson } from '../net/http';
import type { DuelAction } from './model';

export interface DuelConnection {
  joinQueue(mode?: 'duel' | 'team'): Promise<Ack>;
  leaveQueue(): Promise<Ack>;
  /** Re-sends the snapshot of the match the player is already in (a table started it). */
  resume(): Promise<Ack>;
  submit(itemIds: string[]): Promise<Ack>;
  /** 2v2: show the captain the cards the player has picked (replaces the previous proposal). */
  propose(itemIds: string[]): Promise<Ack>;
  leave(): Promise<Ack>;
  /** A hidden guess in the price-guess round (rials). */
  priceGuess(guessRials: bigint): Promise<Ack>;
  taunt(tauntId: string): Promise<Ack>;
  close(): void;
}

const ask = (socket: Socket, event: string, payload?: unknown): Promise<Ack> =>
  new Promise((resolve) => {
    socket.timeout(8000).emit(event, payload ?? {}, (err: unknown, raw: unknown) => {
      const parsed = err ? null : ackSchema.safeParse(raw);
      resolve(parsed?.success ? parsed.data : { ok: false, error: 'INTERNAL' });
    });
  });

/** Opens the live-match socket with the guest token and turns server events into reducer actions. */
export async function connectDuel(dispatch: (a: DuelAction) => void): Promise<DuelConnection> {
  // A saved token the server no longer accepts (e.g. its signing secret changed) would fail the socket handshake as a plain
  // "network" error; the HTTP path renews it on a 401, so check it that way first.
  const token = await session.authed(async (t) => {
    await callJson('/me', 'GET', undefined, t);
    return t;
  }).catch(() => session.token());
  // Long-polling first, then upgrade to a websocket when the host allows it: a proxy or CDN that refuses the upgrade then costs speed, not the whole duel.
  const socket = io(BASE_URL, { auth: { token }, transports: ['polling', 'websocket'], reconnection: true });
  let you: 0 | 1 = 0;

  socket.on(ServerEvent.queueStatus, (p: unknown) => {
    const s = queueStatusSchema.safeParse(p);
    if (s.success) dispatch({ t: 'status', waitedSec: s.data.waitedSec, problem: s.data.problem });
  });
  socket.on(ServerEvent.matchFound, (p: unknown) => {
    const f = matchFoundSchema.safeParse(p);
    if (f.success) {
      you = f.data.you;
      dispatch({ t: 'found', found: f.data });
    }
  });
  socket.on(ServerEvent.matchState, (p: unknown) => {
    const v = matchViewSchema.safeParse(p);
    if (v.success) {
      you = v.data.you;
      dispatch({ t: 'state', view: v.data });
    }
  });
  socket.on(ServerEvent.matchEvent, (p: unknown) => {
    const e = matchEventSchema.safeParse(p);
    if (!e.success) return;
    if (e.data.t === 'guess' && e.data.outcome !== undefined) dispatch({ t: 'guess', outcome: e.data.outcome, mine: e.data.side === you });
    else if (e.data.t === 'timeout') dispatch({ t: 'timeout', mine: e.data.side === you });
    else if (e.data.t === 'board') dispatch({ t: 'board', board: e.data.round + 1, of: e.data.rounds });
  });
  socket.on(ServerEvent.matchEnded, (p: unknown) => {
    const e = matchEndedSchema.safeParse(p);
    if (e.success) dispatch({ t: 'ended', ended: e.data });
  });
  socket.on(ServerEvent.chatMessage, (p: unknown) => {
    const m = chatMessageSchema.safeParse(p);
    if (m.success && m.data.room === 'match') dispatch({ t: 'taunt', from: m.data.nickname, text: m.data.text });
  });
  socket.on('connect_error', () => dispatch({ t: 'error', error: 'NETWORK' }));

  await new Promise<void>((resolve) => {
    if (socket.connected) resolve();
    else socket.once('connect', () => resolve());
    setTimeout(resolve, 8000);
  });

  return {
    joinQueue: (mode = 'duel') => ask(socket, ClientEvent.queueJoin, { mode }),
    leaveQueue: () => ask(socket, ClientEvent.queueLeave),
    resume: () => ask(socket, ClientEvent.matchResume, {}),
    submit: (itemIds) => ask(socket, ClientEvent.matchSubmit, { itemIds }),
    propose: (itemIds) => ask(socket, ClientEvent.matchPropose, { itemIds }),
    leave: () => ask(socket, ClientEvent.matchLeave),
    priceGuess: (guessRials) => ask(socket, ClientEvent.priceSubmit, { guessRials: guessRials.toString() }),
    taunt: (tauntId) => ask(socket, ClientEvent.chatTaunt, { tauntId }),
    close: () => {
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}
