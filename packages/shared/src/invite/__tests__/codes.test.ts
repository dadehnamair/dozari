import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../game/rng.js';
import { generateInviteCode, looksLikeInviteCode, normalizeInviteCode } from '../codes.js';

describe('invite codes', () => {
  it('generates 6 readable characters, deterministic per seed', () => {
    const a = generateInviteCode(mulberry32(5));
    expect(a).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);
    expect(generateInviteCode(mulberry32(5))).toBe(a);
  });
  it('normalises what people type', () => {
    expect(normalizeInviteCode(' ab-c d۲۳4 ')).toBe('ABCD234');
    expect(normalizeInviteCode('abc٢٣٤')).toBe('ABC234');
  });
  it('rejects shapes that cannot be codes', () => {
    expect(looksLikeInviteCode('ABC234')).toBe(true);
    expect(looksLikeInviteCode('ABC')).toBe(false);
    expect(looksLikeInviteCode('ABC0O1')).toBe(false);
  });
});
