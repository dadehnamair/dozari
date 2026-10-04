import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../game/rng.js';
import { AVATAR_KEYS, DEVICE_ID_PATTERN, NICKNAMES, canCustomise, randomGuestIdentity } from '../index.js';
import { AVATAR_CHANGE_MIN_LEVEL, NICKNAME_CHANGE_MIN_LEVEL } from '../../config/game.js';

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

describe('canCustomise (D65)', () => {
  it('needs the redeemed invite code first, then the level', () => {
    expect(canCustomise('avatar', { level: 99, inviteRedeemed: false })).toEqual({ ok: false, reason: 'NEEDS_INVITE', minLevel: AVATAR_CHANGE_MIN_LEVEL });
    expect(canCustomise('avatar', { level: AVATAR_CHANGE_MIN_LEVEL - 1, inviteRedeemed: true })).toMatchObject({ ok: false, reason: 'NEEDS_LEVEL' });
    expect(canCustomise('avatar', { level: AVATAR_CHANGE_MIN_LEVEL, inviteRedeemed: true })).toEqual({ ok: true });
  });

  it('asks more for the nickname than for the avatar', () => {
    const p = { level: AVATAR_CHANGE_MIN_LEVEL, inviteRedeemed: true };
    expect(NICKNAME_CHANGE_MIN_LEVEL).toBeGreaterThan(AVATAR_CHANGE_MIN_LEVEL);
    expect(canCustomise('nickname', p)).toMatchObject({ ok: false, reason: 'NEEDS_LEVEL' });
    expect(canCustomise('nickname', { ...p, level: NICKNAME_CHANGE_MIN_LEVEL })).toEqual({ ok: true });
  });
});
