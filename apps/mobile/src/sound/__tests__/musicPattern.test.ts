import { describe, expect, it } from 'vitest';
import { MUSIC, stepSeconds } from '../musicPattern';

describe('music patterns', () => {
  it('both moods loop over whole bars with audible notes', () => {
    for (const p of Object.values(MUSIC)) {
      expect(p.lead.length % 8).toBe(0);
      expect(p.bass.length).toBe(p.lead.length);
      for (const f of [...p.lead, ...p.bass]) expect(f === 0 || (f > 50 && f < 1500)).toBe(true);
      expect(p.leadGain + p.bassGain).toBeLessThan(0.2); // quieter than the effects (0.18 each)
    }
  });
  it('the tense mood is faster', () => {
    expect(stepSeconds(MUSIC.tense)).toBeLessThan(stepSeconds(MUSIC.calm));
  });
});
