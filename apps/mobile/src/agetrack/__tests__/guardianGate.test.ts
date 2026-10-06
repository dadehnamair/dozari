import { describe, expect, it } from 'vitest';
import { ApiError } from '../../net/http';
import { needsGuardian } from '../guardianGate';

describe('needsGuardian', () => {
  it('recognises the friend and table answers, and nothing else', () => {
    expect(needsGuardian(new ApiError(403, 'needs_guardian'))).toBe(true);
    expect(needsGuardian(new ApiError(403, 'NEEDS_GUARDIAN'))).toBe(true);
    expect(needsGuardian(new ApiError(403, 'LOCKED'))).toBe(false);
    expect(needsGuardian(new ApiError(404, 'needs_guardian'))).toBe(false);
    expect(needsGuardian(new Error('x'))).toBe(false);
  });
});
