import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../game/rng.js';
import { AVATAR_KEYS, DEVICE_ID_PATTERN, NICKNAMES, randomGuestIdentity } from '../index.js';

describe('guest identity', () => {
  it('has 24 distinct avatars and distinct nicknames that fit a varchar(100)', () => {
    expect(AVATAR_KEYS).toHaveLength(24);
    expect(new Set(AVATAR_KEYS).size).toBe(24);
    expect(new Set(NICKNAMES).size).toBe(NICKNAMES.length);
    for (const n of NICKNAMES) expect(n.length).toBeLessThanOrEqual(30);
  });

  it('is deterministic per seed and always comes from the lists', () => {
    expect(randomGuestIdentity(mulberry32(5))).toEqual(randomGuestIdentity(mulberry32(5)));
    for (let seed = 0; seed < 200; seed++) {
      const id = randomGuestIdentity(mulberry32(seed));
      expect(NICKNAMES).toContain(id.nickname);
      expect(AVATAR_KEYS).toContain(id.avatarKey);
    }
  });

  it('accepts uuid-like device ids and rejects junk', () => {
    expect(DEVICE_ID_PATTERN.test('0f8fad5b-d9cb-469f-a165-70867728950e')).toBe(true);
    for (const bad of ['short', 'has space in it 123456', 'x'.repeat(65), '../../etc/passwd/../..', '']) {
      expect(DEVICE_ID_PATTERN.test(bad)).toBe(false);
    }
  });
});
