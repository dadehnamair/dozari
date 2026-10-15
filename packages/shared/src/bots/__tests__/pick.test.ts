import { describe, expect, it } from 'vitest';
import { averageLevel, pickBotByLevel, withoutRecentBots } from '../pick.js';

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

describe('withoutRecentBots', () => {
  const bots = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({ id }));
  it('drops the bots of the last games and of the last minutes', () => {
    const history = ['a', 'b', 'c', 'd', 'e'].map((botId, i) => ({ botId, at: i * 1000 }));
    expect(withoutRecentBots(bots, history, 10 * 60_000).map((b) => b.id)).toEqual(['f', 'g']);
    // a long time later only the last few games still count
    const old = withoutRecentBots(bots, [...history, { botId: 'f', at: 0 }], 5 * 60 * 60_000).map((b) => b.id);
    expect(old).toEqual(['a', 'g']);
  });
  it('never leaves nobody: the bot met longest ago is allowed', () => {
    const history = [{ botId: 'x', at: 100 }, { botId: 'y', at: 200 }];
    expect(withoutRecentBots([{ id: 'x' }, { id: 'y' }], history, 300).map((b) => b.id)).toEqual(['x']);
  });
});
