import { describe, expect, it } from 'vitest';
import { skillTier } from '../skill.js';

const rules = { minGames: 10, proGames: 30, proWinPercent: 60 };

describe('skillTier', () => {
  it('is novice until enough games, pro with games and a high win rate, beginner between', () => {
    expect(skillTier({ games: 9, wins: 9 }, rules)).toBe('novice');
    expect(skillTier({ games: 10, wins: 3 }, rules)).toBe('beginner');
    expect(skillTier({ games: 29, wins: 29 }, rules)).toBe('beginner');
    expect(skillTier({ games: 30, wins: 17 }, rules)).toBe('beginner'); // 56.7%
    expect(skillTier({ games: 30, wins: 18 }, rules)).toBe('pro');
  });
});
