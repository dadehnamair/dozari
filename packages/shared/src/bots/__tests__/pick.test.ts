import { describe, expect, it } from 'vitest';
import { averageLevel, pickBotByLevel } from '../pick.js';

const bots = [{ id: 'a', level: 3 }, { id: 'b', level: 4 }, { id: 'c', level: 20 }, { id: 'd', level: 25 }];

describe('pickBotByLevel', () => {
  it('never gives a level-3 player a level-20 bot while a near bot exists', () => {
    for (let i = 0; i < 50; i++) expect(['a', 'b']).toContain(pickBotByLevel(bots, 3, () => i / 50)!.id);
  });
  it('gives a level-22 player a high bot', () => {
    for (let i = 0; i < 50; i++) expect(['c', 'd']).toContain(pickBotByLevel(bots, 22, () => i / 50)!.id);
  });
  it('takes the closest bots when none is within the gap', () => {
    expect(pickBotByLevel([{ id: 'x', level: 10 }, { id: 'y', level: 30 }], 1, () => 0.99)!.id).toBe('x');
  });
  it('is null with no bots, and a bot without a level counts as level 1', () => {
    expect(pickBotByLevel([], 5, () => 0)).toBeNull();
    expect(pickBotByLevel([{ id: 'z' }, { id: 'w', level: 18 }], 2, () => 0.9)!.id).toBe('z');
  });
  it('averages the levels of a team', () => {
    expect(averageLevel([2, 4])).toBe(3);
    expect(averageLevel([])).toBe(1);
  });
});
