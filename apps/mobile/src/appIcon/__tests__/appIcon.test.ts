import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo', () => ({ requireOptionalNativeModule: () => null }));

import { applyAppIcon, iconFor } from '../appIcon';

describe('iconFor', () => {
  it('defaults to the adult icons while the track is unknown', () => {
    expect(iconFor('female')).toBe('adultFemale');
    expect(iconFor('male')).toBe('adult');
    expect(iconFor(null)).toBe('adult');
    expect(iconFor(undefined)).toBe('adult');
  });

  it('kid and teen keep the candy icons, adult gets the gold ones', () => {
    expect(iconFor('male', 'kid')).toBe('default');
    expect(iconFor('female', 'teen')).toBe('female');
    expect(iconFor('male', 'adult')).toBe('adult');
    expect(iconFor('female', 'adult')).toBe('adultFemale');
    expect(iconFor(null, 'adult')).toBe('adult');
  });
});

describe('applyAppIcon', () => {
  it('does nothing without the native module', () => {
    expect(() => applyAppIcon('female', 'adult')).not.toThrow();
  });
});
