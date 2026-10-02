import { describe, expect, it } from 'vitest';
import { levelRoadSchema } from '@dozari/shared';
import { LevelRoadService } from '../progress/road.js';

describe('level road (D109)', () => {
  const claimed: number[] = [];
  const level = { v: 3 };
  const svc = (gates: Record<string, number | undefined>) =>
    new LevelRoadService({
      levelOf: async () => ({ level: level.v, xp: 220, xpInLevel: 70, xpForNext: 130 }),
      xpRules: async () => ({ curveBase: 50, levelMax: 20 }),
      rewardRules: async () => ({ every: 5, base: 25 }),
      claimedLevels: async () => claimed,
      payRewards: async (_u, rs) => (rs.forEach((r) => claimed.push(r.level)), { paid: rs, balance: 500 }),
      gates: async () => gates,
      shopItems: async () => [
        { titleFa: 'یک راهنما', iconKey: 'magnifier', minLevel: 2, isActive: true },
        { titleFa: 'پنهان', iconKey: null, minLevel: 9, isActive: false },
        { titleFa: 'از اول', iconKey: null, minLevel: 1, isActive: true },
      ],
    });

  it('lists what each level opens, sorted, from the real gates and active shop items', async () => {
    const road = levelRoadSchema.parse(await svc({ hint: 2, invite: 5, transfer: 5, avatar: 1 }).road('u'));
    expect(road).toMatchObject({ level: 3, xp: 220, curveBase: 50, levelMax: 20 });
    expect(road.unlocks.map((u) => [u.level, u.kind, u.titleFa])).toEqual([[2, 'hint', null], [2, 'shop', 'یک راهنما'], [5, 'invite', null], [5, 'transfer', null]]);
  });

  it('skips unset gates', async () => {
    expect((await svc({}).road('u')).unlocks.map((u) => u.kind)).toEqual(['shop']);
  });

  it('lists a coin reward every 5th level, growing with the level', async () => {
    const road = await svc({}).road('u');
    expect(road.rewards).toEqual([{ level: 5, coins: 25, claimed: false }, { level: 10, coins: 50, claimed: false }, { level: 15, coins: 75, claimed: false }, { level: 20, coins: 100, claimed: false }]);
  });

  it('pays only the rewards the player has reached, once', async () => {
    claimed.length = 0;
    level.v = 11;
    const first = await svc({}).claim('u');
    expect(first).toMatchObject({ levels: [5, 10], coins: 75, balance: 500 });
    expect((await svc({}).claim('u')).levels).toEqual([]);
    level.v = 3;
    claimed.length = 0;
    expect((await svc({}).claim('u')).coins).toBe(0);
  });
});
