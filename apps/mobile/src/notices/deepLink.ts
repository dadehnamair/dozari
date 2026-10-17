/** Where a tap on a push (or on the in-app notice) should land; mirrors `deepLinkOf` in apps/server/src/notify/webpush.ts. */
export type NoticeLink = { kind: 'dm'; id: string } | { kind: 'friends' } | { kind: 'table'; code: string } | { kind: 'inbox' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parses `dozari://open/dm/<id>`, `/friends`, `/table/<code>`, `/inbox`; anything else (an invite link, a web URL) is null. */
export function parseNoticeLink(url: string | null | undefined): NoticeLink | null {
  const m = /^dozari:\/\/open\/([a-z]+)(?:\/([^/?#\s]+))?\/?(?:[?#].*)?$/i.exec(url?.trim() ?? '');
  if (!m) return null;
  const arg = m[2] ? safeDecode(m[2]) : null;
  switch (m[1]!.toLowerCase()) {
    case 'dm':
      return arg && UUID.test(arg) ? { kind: 'dm', id: arg } : { kind: 'friends' };
    case 'friends':
      return { kind: 'friends' };
    case 'table':
      return arg ? { kind: 'table', code: arg } : null;
    case 'inbox':
      return { kind: 'inbox' };
    default:
      return null;
  }
}

function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

/** The link for a live notice shown inside the open app, or null when there is nothing to open (pure; tested). */
export function linkOfNotice(n: { kind: string; fromId?: string; code?: string }): NoticeLink | null {
  switch (n.kind) {
    case 'dm':
      return n.fromId ? { kind: 'dm', id: n.fromId } : { kind: 'friends' };
    case 'friend_request':
      return { kind: 'friends' };
    case 'table_invite':
      return n.code ? { kind: 'table', code: n.code } : null;
    case 'inbox':
      return { kind: 'inbox' };
    default:
      return null;
  }
}
