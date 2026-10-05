import { io } from 'socket.io-client';
import { ServerEvent, liveNoticeSchema } from '@dozari/shared';
import type { LiveNotice } from '@dozari/shared';
import { session } from '../auth';
import { BASE_URL, callJson } from '../net/http';

/**
 * A quiet socket for the Home screen (no queue, no match): the server pushes «something new for you» (a friend request,
 * an inbox message) and the app reacts at once instead of waiting for the next reload. It also makes the player show as
 * online to friends. Returns a function that closes it. Any failure is silent: the lists still load the normal way.
 */
export function connectNotices(onNotice: (n: LiveNotice) => void): () => void {
  let closed = false;
  let close = () => undefined as void;
  void (async () => {
    const token = await session
      .authed(async (t) => {
        await callJson('/me', 'GET', undefined, t);
        return t;
      })
      .catch(() => session.token());
    if (closed || !token) return;
    const socket = io(BASE_URL, { auth: { token }, transports: ['polling', 'websocket'], reconnection: true, reconnectionDelayMax: 30_000 });
    socket.on(ServerEvent.notice, (p: unknown) => {
      const n = liveNoticeSchema.safeParse(p);
      if (n.success) onNotice(n.data);
    });
    socket.on('connect_error', () => undefined);
    close = () => void socket.close();
    if (closed) close();
  })();
  return () => {
    closed = true;
    close();
  };
}
