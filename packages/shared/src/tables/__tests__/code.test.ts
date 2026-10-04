import { describe, expect, it } from 'vitest';
import { TABLE_CODE_ALPHABET, TABLE_CODE_LENGTH, makeTableCode, normalizeTableCode } from '../code.js';

describe('table codes', () => {
  it('uses only unambiguous characters', () => {
    for (const bad of '01OIL') expect(TABLE_CODE_ALPHABET).not.toContain(bad);
    expect(makeTableCode(Math.random)).toHaveLength(TABLE_CODE_LENGTH);
  });
  it('normalises what people type', () => {
    expect(normalizeTableCode(' ab-c d2 ')).toBe('ABCD2');
    expect(normalizeTableCode('ABCD0')).toBeNull();
    expect(normalizeTableCode('ABC')).toBeNull();
  });
});
