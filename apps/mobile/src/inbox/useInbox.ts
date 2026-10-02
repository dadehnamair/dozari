import { useCallback, useEffect, useState } from 'react';
import type { Inbox } from '@dozari/shared';
import { fetchInbox, markAllInboxRead, markInboxRead } from './api';

/** Loads the inbox once; `markRead` updates the list locally so the badge drops at once. */
export function useInbox() {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    fetchInbox().then(
      (i) => (setInbox(i), setFailed(false)),
      () => setFailed(true),
    );
  }, []);
  useEffect(load, [load]);

  const markRead = useCallback((id: string) => {
    setInbox((cur) => {
      if (!cur) return cur;
      const wasUnread = cur.items.some((m) => m.id === id && !m.read);
      return { unread: Math.max(0, cur.unread - (wasUnread ? 1 : 0)), items: cur.items.map((m) => (m.id === id ? { ...m, read: true } : m)) };
    });
    markInboxRead(id).catch(() => undefined);
  }, []);

  const markAll = useCallback(() => {
    setInbox((cur) => (cur ? { unread: 0, items: cur.items.map((m) => ({ ...m, read: true })) } : cur));
    markAllInboxRead().catch(() => undefined);
  }, []);

  return { inbox, failed, reload: load, markRead, markAll };
}
