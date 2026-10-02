import { describe, expect, it } from 'vitest';
import { handPosition } from '../heroToss';

describe('handPosition', () => {
  it('puts the raised hand on the right side, in the upper half of the hero box', () => {
    for (const [w, h] of [[180, 197], [130, 142]] as const) {
      const p = handPosition(w, h);
      expect(p.x).toBeGreaterThan(w * 0.6);
      expect(p.x).toBeLessThan(w);
      expect(p.y).toBeGreaterThan(h * 0.3);
      expect(p.y).toBeLessThan(h * 0.5);
    }
  });

  it('scales with the box', () => {
    expect(handPosition(180, 197).scale).toBeGreaterThan(handPosition(130, 142).scale);
  });
});
