import { describe, expect, it } from 'vitest';
import { heroFor } from '../heroFor';

describe('heroFor', () => {
  it('uses the female hero only when the player chose female', () => {
    expect(heroFor('female')).toBe('dozariF');
    expect(heroFor('male')).toBe('dozari');
    expect(heroFor(null)).toBe('dozari');
    expect(heroFor(undefined)).toBe('dozari');
  });
});
