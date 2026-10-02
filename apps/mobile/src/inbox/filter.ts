export type InboxFilter = 'all' | 'unread' | 'read';

/** The messages a filter keeps, in their original order. */
export const filterInbox = <T extends { read: boolean }>(items: readonly T[], f: InboxFilter): T[] => items.filter((m) => f === 'all' || (f === 'unread' ? !m.read : m.read));
