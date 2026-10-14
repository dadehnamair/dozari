import type { LiveNotice } from '@dozari/shared';
import { fa } from '../i18n/fa';

/** The title and body for a live notice, or null when it needs none (pure; tested). */
export function noticeNotification(n: LiveNotice): { title: string; body: string; tag: string } | null {
  const w = fa.webNotify;
  switch (n.kind) {
    case 'friend_request':
      return { title: fa.home.title, body: w.friendRequest(n.from ?? ''), tag: 'friend_request' };
    case 'dm':
      return { title: fa.home.title, body: w.dm(n.from ?? ''), tag: `dm:${n.from ?? ''}` };
    case 'table_invite':
      return { title: fa.home.title, body: w.tableInvite(n.from ?? ''), tag: `table_invite:${n.code ?? ''}` };
    case 'table_request':
      return { title: fa.home.title, body: w.tableRequest(n.from ?? ''), tag: `table_request:${n.from ?? ''}` };
    case 'table_answer':
      return { title: fa.home.title, body: n.accepted ? w.tableAccepted : w.tableDeclined, tag: 'table_answer' };
    case 'inbox':
      return { title: fa.home.title, body: w.inbox, tag: 'inbox' };
    default:
      return null;
  }
}
