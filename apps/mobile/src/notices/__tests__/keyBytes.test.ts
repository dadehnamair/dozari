import { describe, expect, it } from 'vitest';
import { keyBytes } from '../keyBytes';

describe('keyBytes', () => {
  it('decodes URL-safe base64 without padding', () => {
    expect([...keyBytes('AQID')]).toEqual([1, 2, 3]);
    expect([...keyBytes('-_8')]).toEqual([251, 255]);
  });
});
