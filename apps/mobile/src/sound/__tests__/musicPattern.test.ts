import { describe, expect, it } from 'vitest';
import { MUSIC, stepSeconds } from '../musicPattern';

describe('music patterns', () => {
  it('both moods loop over whole bars with audible notes and a matching drum line', () => {
    for (const p of Object.values(MUSIC)) {
      expect(p.lead.length % p.stepsPerBar).toBe(0);
      expect(p.bass.length).toBe(p.lead.length);
      expect(p.drum.length).toBe(p.lead.length);
      for (const f of [...p.lead, ...p.bass]) expect(f === 0 || (f > 50 && f < 1500)).toBe(true);
      expect(p.leadGain + p.bassGain + p.drumGain).toBeLessThan(0.3); // quiet next to the effects (0.18 each)
    }
  });
  it('the tense mood is faster', () => {
    expect(stepSeconds(MUSIC.tense)).toBeLessThan(stepSeconds(MUSIC.calm));
  });
  it('the calm loop is a lilting 6/8 of 16 bars and uses the half-flat second', () => {
    expect(MUSIC.calm.stepsPerBar).toBe(6);
    expect(MUSIC.calm.lead.length / 6).toBe(16);
    expect(MUSIC.calm.lead).toContain(320);
  });
});
