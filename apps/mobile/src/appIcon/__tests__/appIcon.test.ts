import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo', () => ({ requireOptionalNativeModule: () => null }));

import { applyAppIcon, iconFor } from '../appIcon';

describe('iconFor', () => {
  it('uses the female icon only for female players', () => {
    expect(iconFor('female')).toBe('female');
    expect(iconFor('male')).toBe('default');
    expect(iconFor(null)).toBe('default');
    expect(iconFor(undefined)).toBe('default');
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
