import { describe, expect, it } from 'vitest';
import { matchResumeSchema } from '../events.js';

describe('match:resume payload', () => {
  it('accepts no match id (resume whatever match the player is in) or a uuid, nothing else', () => {
    expect(matchResumeSchema.safeParse({}).success).toBe(true);
    expect(matchResumeSchema.safeParse({ matchId: '0f8fad5b-d9cb-469f-a165-708677289501' }).success).toBe(true);
    expect(matchResumeSchema.safeParse({ matchId: 'nope' }).success).toBe(false);
  });
});
