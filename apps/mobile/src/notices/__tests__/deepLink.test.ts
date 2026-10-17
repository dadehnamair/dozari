import { describe, expect, it } from 'vitest';
import { linkOfNotice, parseNoticeLink } from '../deepLink';

const id = '01a100f2-3995-70bc-90c0-d644921e3b13';

describe('parseNoticeLink', () => {
  it('reads every push link', () => {
    expect(parseNoticeLink(`dozari://open/dm/${id}`)).toEqual({ kind: 'dm', id });
    expect(parseNoticeLink('dozari://open/friends')).toEqual({ kind: 'friends' });
    expect(parseNoticeLink('dozari://open/table/AB%2012')).toEqual({ kind: 'table', code: 'AB 12' });
    expect(parseNoticeLink('dozari://open/inbox')).toEqual({ kind: 'inbox' });
  });
  it('falls back to the friends page for a malformed player id, and ignores other links', () => {
    expect(parseNoticeLink('dozari://open/dm/not-an-id')).toEqual({ kind: 'friends' });
    expect(parseNoticeLink('dozari://i/ABC2345')).toBeNull();
    expect(parseNoticeLink('https://example.com/open/inbox')).toBeNull();
    expect(parseNoticeLink('dozari://open/nothing')).toBeNull();
    expect(parseNoticeLink(null)).toBeNull();
  });
});

describe('linkOfNotice', () => {
  it('maps the live notices to what a tap opens', () => {
    expect(linkOfNotice({ kind: 'dm', fromId: id })).toEqual({ kind: 'dm', id });
    expect(linkOfNotice({ kind: 'dm' })).toEqual({ kind: 'friends' });
    expect(linkOfNotice({ kind: 'friend_request' })).toEqual({ kind: 'friends' });
    expect(linkOfNotice({ kind: 'table_invite', code: 'X1' })).toEqual({ kind: 'table', code: 'X1' });
    expect(linkOfNotice({ kind: 'table_answer' })).toBeNull();
  });
});
