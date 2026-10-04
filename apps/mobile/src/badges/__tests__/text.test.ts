import { describe, expect, it } from 'vitest';
import { progressText, skillText } from '../text';

describe('badge texts', () => {
  it('names the skill tiers', () => {
    expect(skillText('novice')).toBe('تازه‌کار');
    expect(skillText('beginner')).toBe('مبتدی');
    expect(skillText('pro')).toBe('حرفه‌ای');
  });
  it('shows progress capped at the target', () => {
    expect(progressText('level', 7, 10)).toBe('سطح: ۷ از ۱۰');
    expect(progressText('wins', 99, 20)).toBe('برد: ۲۰ از ۲۰');
  });
});
