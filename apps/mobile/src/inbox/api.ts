import { inboxSchema } from '@dozari/shared';
import type { Inbox } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

export const fetchInbox = (): Promise<Inbox> => session.authed(async (token) => inboxSchema.parse(await callJson('/inbox', 'GET', undefined, token)));

export const markInboxRead = (id: string): Promise<void> =>
  session.authed(async (token) => {
    await callJson(`/inbox/${id}/read`, 'POST', undefined, token);
  });

export const markAllInboxRead = (): Promise<void> =>
  session.authed(async (token) => {
    await callJson('/inbox/read-all', 'POST', undefined, token);
  });
