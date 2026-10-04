import { describe, expect, it } from 'vitest';
import { inviteMessage, redeemErrorText } from '../inviteText';

describe('invite texts', () => {
  it('builds the share message with the code and the bonus', () => {
    const m = inviteMessage('ABC234', 50);
    expect(m).toContain('ABC234');
    expect(m).toContain('۵۰');
  });
  it('maps server errors to Persian, with a fallback', () => {
    expect(redeemErrorText('own_code')).toBe('این کد خودت است.');
    expect(redeemErrorText('exhausted')).toContain('پر شده');
    expect(redeemErrorText('whatever')).toBe('نتوانستیم کد را بررسی کنیم.');
  });
});
