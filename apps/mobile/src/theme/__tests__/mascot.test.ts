import { describe, expect, it } from 'vitest';
import { MASCOT_POSES, MASCOT_SKINS, mascotLook } from '../mascot';

describe('mascotLook', () => {
  it('defines a look for every pose', () => {
    for (const pose of MASCOT_POSES) expect(mascotLook(pose).mouth).toMatch(/^M/);
  });

  it('crops to the face for avatars', () => {
    expect(mascotLook('idle', 0, 'face')).toMatchObject({ full: false, viewBox: '24 18 152 152' });
    expect(mascotLook('idle')).toMatchObject({ full: true, viewBox: '-12 -8 224 226' });
  });

  it('clamps unknown skins', () => {
    expect(mascotLook('idle', 99).skinIndex).toBe(MASCOT_SKINS.length - 1);
    expect(mascotLook('idle', -3).skinIndex).toBe(0);
    expect(mascotLook('idle', Number.NaN).skinIndex).toBe(0);
  });

  it('moves the pupils with the pose', () => {
    expect(mascotLook('pointing').pupilRightX).toBe(130);
    expect(mascotLook('thinking')).toMatchObject({ pupilLeftX: 81, pupilY: 87 });
  });

  it('only crowns the winner and only tears the sad one', () => {
    expect(MASCOT_POSES.filter((p) => mascotLook(p).crown)).toEqual(['win']);
    expect(MASCOT_POSES.filter((p) => mascotLook(p).tear)).toEqual(['sad']);
  });
});
