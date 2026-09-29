import { describe, expect, it } from 'vitest';
import { fa } from '../fa.js';

describe('fa i18n strings', () => {
  it('has the placeholder home strings', () => {
    expect(fa.home.title).toBe('دوزاری');
  });
});
