import { describe, expect, it } from 'vitest';
import { isMainModule } from '../is-main.js';

describe('isMainModule', () => {
  it('matches a POSIX entry path', () => {
    expect(isMainModule('file:///home/u/app/src/index.ts', '/home/u/app/src/index.ts', false)).toBe(true);
    expect(isMainModule('file:///home/u/app/src/index.ts', '/home/u/app/src/other.ts', false)).toBe(false);
  });

  it('is false without an entry path', () => {
    expect(isMainModule('file:///home/u/app/src/index.ts', undefined, false)).toBe(false);
  });
});
