import { describe, expect, it } from 'vitest';
import { parseInviteLink } from '../inviteLink';

describe('parseInviteLink', () => {
  it('reads the ID from the app scheme and from a web link', () => {
    expect(parseInviteLink('dozari://i/abc2345')).toBe('ABC2345');
    expect(parseInviteLink('https://dozari.app/i/ABC2345?utm=x')).toBe('ABC2345');
    expect(parseInviteLink(' http://s.ir/i/ABC2345/ ')).toBe('ABC2345');
  });
  it('ignores everything else', () => {
    for (const u of [null, undefined, '', 'dozari://solo', 'https://dozari.app/x/ABC2345', 'dozari://i/AB', 'javascript:alert(1)']) expect(parseInviteLink(u)).toBeNull();
  });
});
