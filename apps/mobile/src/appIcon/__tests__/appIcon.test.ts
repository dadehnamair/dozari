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
});

describe('applyAppIcon', () => {
  it('does nothing without the native module', () => {
    expect(() => applyAppIcon('female')).not.toThrow();
  });
});
