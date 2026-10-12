import { describe, expect, it } from 'vitest';
import { leaverUntilText } from '../leaver';

describe('leaverUntilText', () => {
  it('names the Tehran day the badge comes off', () => {
    // 2026-10-12 12:00 Tehran = 21 Mehr 1405
    expect(leaverUntilText(Date.UTC(2026, 9, 12, 8, 30))).toBe('تا ۲۰ مهر برداشته می‌شود');
  });
});
