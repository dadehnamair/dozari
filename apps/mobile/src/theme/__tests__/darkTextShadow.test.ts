import { describe, expect, it } from 'vitest';
import { brightnessOf, smearsDarkText } from '../darkText';

describe('dark text shadow fix', () => {
  it('reads hex and rgb colours', () => {
    expect(brightnessOf('#000')).toBe(0);
    expect(brightnessOf('#ffffff')).toBeCloseTo(1);
    expect(brightnessOf('rgba(42,22,6,1)')).toBeLessThan(0.2);
    expect(brightnessOf('transparent')).toBeNull();
    expect(brightnessOf(undefined)).toBeNull();
  });

  it('flags dark text that still has a shadow, not light text or an absent shadow', () => {
    expect(smearsDarkText({ color: '#2A1606', textShadowColor: '#FFF6E8' })).toBe(true);
    expect(smearsDarkText({ color: '#fff', textShadowColor: '#2B1240' })).toBe(false);
    expect(smearsDarkText({ color: '#2A1606', textShadowColor: 'transparent' })).toBe(false);
    expect(smearsDarkText({ color: '#2A1606' })).toBe(false);
  });
});
