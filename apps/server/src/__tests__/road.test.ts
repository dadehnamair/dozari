import { describe, expect, it } from 'vitest';
import { levelRoadSchema } from '@dozari/shared';
import { LevelRoadService } from '../progress/road.js';

describe('level road (D109)', () => {
  const svc = (gates: Record<string, number | undefined>) =>
    new LevelRoadService({
      levelOf: async () => ({ level: 3, xp: 220, xpInLevel: 70, xpForNext: 130 }),
      xpRules: async () => ({ curveBase: 50, levelMax: 50 }),
      gates: async () => gates,
      shopItems: async () => [
        { titleFa: 'یک راهنما', iconKey: 'magnifier', minLevel: 2, isActive: true },
        { titleFa: 'پنهان', iconKey: null, minLevel: 9, isActive: false },
        { titleFa: 'از اول', iconKey: null, minLevel: 1, isActive: true },
      ],
    });

  it('lists what each level opens, sorted, from the real gates and active shop items', async () => {
    const road = levelRoadSchema.parse(await svc({ hint: 2, invite: 5, transfer: 5, avatar: 1 }).road('u'));
    expect(road).toMatchObject({ level: 3, xp: 220, curveBase: 50, levelMax: 50 });
    expect(road.unlocks.map((u) => [u.level, u.kind, u.titleFa])).toEqual([[2, 'hint', null], [2, 'shop', 'یک راهنما'], [5, 'invite', null], [5, 'transfer', null]]);
  });

  it('skips unset gates', async () => {
    expect((await svc({}).road('u')).unlocks.map((u) => u.kind)).toEqual(['shop']);
  });
});
