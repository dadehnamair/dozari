import type { FastifyInstance } from 'fastify';
import { levelRewardCoins, levelStartAt, rewardLevels } from '@dozari/shared';
import type { LevelClaim, LevelInfo, LevelRoad, LevelRow, Unlock, XpRules } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';

/** Level gates read from the admin settings, one per kind (`hint.min_level`, `invite.min_level` …). */
export type SettingGates = Partial<Record<'hint' | 'invite' | 'transfer' | 'avatar' | 'nickname', number>>;

export interface RoadDeps {
  levelOf(userId: string): Promise<LevelInfo>;
  xpRules(): Promise<Pick<XpRules, 'curveBase' | 'levelMax' | 'starts'>>;
  /** The admin's level table, whose coin column replaces the every-Nth-level formula; null/absent = the formula. */
  table?(): Promise<LevelRow[] | null>;
  gates(): Promise<SettingGates>;
  shopItems(): Promise<{ titleFa: string; iconKey: string | null; minLevel: number; isActive: boolean }[]>;
  /** `every` / `base` of the level reward (admin settings); `every` 0 = off. */
  rewardRules(): Promise<{ every: number; base: number }>;
  /** Levels this player already took the reward of. */
  claimedLevels(userId: string): Promise<number[]>;
  /** Pays the reward of each level through the ledger (`level_reward`, key per user + level; a repeat is a no-op). Returns the balance after. */
  payRewards(userId: string, rewards: { level: number; coins: number; spins: number }[]): Promise<{ paid: { level: number; coins: number; spins: number }[]; balance: number }>;
}

/** The level road (D109): what each level opens, from the real gates, so the screen never drifts from the rules. */
export class LevelRoadService {
  constructor(private readonly deps: RoadDeps) {}

  async road(userId: string): Promise<LevelRoad> {
    const [lv, rules, gates, items, reward, claimed, table] = await Promise.all([this.deps.levelOf(userId), this.deps.xpRules(), this.deps.gates(), this.deps.shopItems(), this.deps.rewardRules(), this.deps.claimedLevels(userId), this.deps.table?.() ?? Promise.resolve(null)]);
    const unlocks: Unlock[] = [];
    for (const [kind, level] of Object.entries(gates) as [keyof SettingGates, number][]) {
      if (level > 1) unlocks.push({ level, kind, titleFa: null, iconKey: null });
    }
    for (const it of items) if (it.isActive && it.minLevel > 1) unlocks.push({ level: it.minLevel, kind: 'shop', titleFa: it.titleFa, iconKey: it.iconKey });
    unlocks.sort((a, b) => a.level - b.level || a.kind.localeCompare(b.kind) || (a.titleFa ?? '').localeCompare(b.titleFa ?? ''));
    const took = new Set(claimed);
    const paid = table ? table.map((r) => ({ level: r.level, coins: r.rewardCoins, spins: r.rewardSpins ?? 0 })) : rewardLevels(rules.levelMax, reward.every).map((level) => ({ level, coins: levelRewardCoins(level, reward.every, reward.base), spins: 0 }));
    const rewards = paid.filter((r) => r.coins > 0 || r.spins > 0).map((r) => ({ ...r, claimed: took.has(r.level) }));
    const starts = Array.from({ length: rules.levelMax }, (_, i) => levelStartAt(i + 1, rules));
    return { level: lv.level, xp: lv.xp, xpInLevel: lv.xpInLevel, xpForNext: lv.xpForNext, curveBase: rules.curveBase, levelMax: rules.levelMax, starts, unlocks, rewards };
  }

  /** Takes every reward the player has reached and not yet taken. */
  async claim(userId: string): Promise<LevelClaim> {
    const road = await this.road(userId);
    const due = road.rewards.filter((r) => !r.claimed && r.level <= road.level).map((r) => ({ level: r.level, coins: r.coins, spins: r.spins }));
    const out = await this.deps.payRewards(userId, due);
    return { ok: true, levels: out.paid.map((p) => p.level), coins: out.paid.reduce((n, p) => n + p.coins, 0), spins: out.paid.reduce((n, p) => n + p.spins, 0), balance: out.balance };
  }
}

export function registerRoadRoutes(app: FastifyInstance, auth: AuthService, road: LevelRoadService) {
  app.get('/me/levels', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return road.road(user.id);
  });

  app.post('/me/levels/claim', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return road.claim(user.id);
  });
}
