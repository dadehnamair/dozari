import { describe, expect, it } from 'vitest';
import { heroFor, heroOf } from '../heroFor';

describe('heroFor', () => {
  it('uses the female hero only when the player chose female', () => {
    expect(heroFor('female')).toBe('dozariF');
    expect(heroFor('male')).toBe('dozari');
    expect(heroFor(null)).toBe('dozari');
    expect(heroFor(undefined)).toBe('dozari');
  });
});

describe('heroOf', () => {
  it('lets a picked cast avatar win over the gender default', () => {
    expect(heroOf('female', 'char-ajan')).toBe('ajan');
    expect(heroOf('female', 'avatar-03')).toBe('dozariF');
    expect(heroOf(null, null)).toBe('dozari');
  });
});
