import { describe, expect, it } from 'vitest';
import { filterInbox } from '../filter';

describe('filterInbox', () => {
  const items = [{ id: 'a', read: false }, { id: 'b', read: true }, { id: 'c', read: false }];
  it('keeps everything, only unread, or only read — in order', () => {
    expect(filterInbox(items, 'all').map((m) => m.id)).toEqual(['a', 'b', 'c']);
    expect(filterInbox(items, 'unread').map((m) => m.id)).toEqual(['a', 'c']);
    expect(filterInbox(items, 'read').map((m) => m.id)).toEqual(['b']);
  });
});
