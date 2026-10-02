import type { FastifyInstance } from 'fastify';
import type { LevelInfo, LevelRoad, Unlock, XpRules } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';

/** Level gates read from the admin settings, one per kind (`hint.min_level`, `invite.min_level` …). */
export type SettingGates = Partial<Record<'hint' | 'invite' | 'transfer' | 'avatar' | 'nickname', number>>;

export interface RoadDeps {
  levelOf(userId: string): Promise<LevelInfo>;
  xpRules(): Promise<Pick<XpRules, 'curveBase' | 'levelMax'>>;
  gates(): Promise<SettingGates>;
  shopItems(): Promise<{ titleFa: string; iconKey: string | null; minLevel: number; isActive: boolean }[]>;
}

/** The level road (D109): what each level opens, from the real gates, so the screen never drifts from the rules. */
export class LevelRoadService {
  constructor(private readonly deps: RoadDeps) {}

  async road(userId: string): Promise<LevelRoad> {
    const [lv, rules, gates, items] = await Promise.all([this.deps.levelOf(userId), this.deps.xpRules(), this.deps.gates(), this.deps.shopItems()]);
    const unlocks: Unlock[] = [];
    for (const [kind, level] of Object.entries(gates) as [keyof SettingGates, number][]) {
      if (level > 1) unlocks.push({ level, kind, titleFa: null, iconKey: null });
    }
    for (const it of items) if (it.isActive && it.minLevel > 1) unlocks.push({ level: it.minLevel, kind: 'shop', titleFa: it.titleFa, iconKey: it.iconKey });
    unlocks.sort((a, b) => a.level - b.level || a.kind.localeCompare(b.kind) || (a.titleFa ?? '').localeCompare(b.titleFa ?? ''));
    return { level: lv.level, xp: lv.xp, xpInLevel: lv.xpInLevel, xpForNext: lv.xpForNext, curveBase: rules.curveBase, levelMax: rules.levelMax, unlocks };
  }
}

export function registerRoadRoutes(app: FastifyInstance, auth: AuthService, road: LevelRoadService) {
  app.get('/me/levels', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return road.road(user.id);
  });
}
