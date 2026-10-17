import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo', () => ({ requireOptionalNativeModule: () => null }));

import { applyAppIcon, iconFor } from '../appIcon';

describe('iconFor', () => {
  it('follows gender only: female hero for female, male hero otherwise', () => {
    expect(iconFor('female')).toBe('adultFemale');
    expect(iconFor('male')).toBe('adult');
    expect(iconFor(null)).toBe('adult');
    expect(iconFor(undefined)).toBe('adult');
  });

  it('ignores the age track (no candy icons any more)', () => {
    expect(iconFor('male', 'kid')).toBe('adult');
    expect(iconFor('female', 'teen')).toBe('adultFemale');
    expect(iconFor('female', 'adult')).toBe('adultFemale');
  });
});

describe('applyAppIcon', () => {
  it('does nothing without the native module', () => {
    expect(() => applyAppIcon('female', 'adult')).not.toThrow();
  });
});
