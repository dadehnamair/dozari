import { AVATAR_KEYS, levelInfo, pickBotNames, plausibleStats } from '@dozari/shared';
import type { Rng, XpRules } from '@dozari/shared';
import type { BotPatch, BotPlayerStore } from './store.js';

export interface GenerateOptions {
  count: number;
  levelMin: number;
  levelMax: number;
  skillMin: number;
  skillMax: number;
  winPercentMin: number;
  winPercentMax: number;
  thinkMinMs: number;
  thinkMaxMs: number;
  tauntPercent: number;
  /** Cities to pick from (one per bot, at random); empty = no city. */
  cityIds: readonly string[];
}

export const MAX_BOTS_PER_CALL = 50;

/** Admin side of bot players: make many natural-looking accounts at once, tune or pause them. Never visible to players. */
export class BotPlayerService {
  constructor(
    private readonly store: BotPlayerStore,
    private readonly xp: () => Promise<XpRules>,
    private readonly rng: Rng,
    /** Runs after a bot is made (e.g. award the medals its stats earn). */
    private readonly afterCreate?: (userId: string) => Promise<void>,
  ) {}

  private between(lo: number, hi: number): number {
    return Math.round(lo + this.rng() * (Math.max(lo, hi) - lo));
  }

  /** Creates up to `count` bots with distinct names; returns how many it could make (the name pool is finite). */
  async generate(o: GenerateOptions): Promise<{ created: string[] }> {
    const count = Math.max(1, Math.min(MAX_BOTS_PER_CALL, Math.floor(o.count)));
    const rules = await this.xp();
    const names = pickBotNames(count, await this.store.nicknames(), this.rng);
    const created: string[] = [];
    for (const nickname of names) {
      const level = Math.max(1, Math.min(rules.levelMax, this.between(o.levelMin, o.levelMax)));
      const stats = plausibleStats({ level, winPercent: this.between(o.winPercentMin, o.winPercentMax), curveBase: rules.curveBase, avgXpPerGame: (rules.soloBase + rules.duelBase) / 2 + rules.winBonus / 2 }, this.rng);
      const min = Math.max(1000, Math.min(o.thinkMinMs, o.thinkMaxMs));
      const id = await this.store.create({
        nickname,
        avatarKey: AVATAR_KEYS[Math.floor(this.rng() * AVATAR_KEYS.length)] as string,
        gender: this.rng() < 0.45 ? 'female' : this.rng() < 0.8 ? 'male' : null,
        cityId: o.cityIds.length > 0 ? (o.cityIds[Math.floor(this.rng() * o.cityIds.length)] as string) : null,
        skill: this.between(o.skillMin, o.skillMax),
        thinkMinMs: min,
        thinkMaxMs: Math.max(min, o.thinkMaxMs),
        tauntPercent: Math.max(0, Math.min(100, o.tauntPercent)),
        // Coins in the range a player of that level plausibly holds; round numbers look fake.
        coins: Math.round(60 + level * (20 + this.rng() * 40) + this.rng() * 100),
        stats,
      });
      created.push(id);
      await this.afterCreate?.(id).catch(() => undefined);
    }
    return { created };
  }

  async list() {
    const rules = await this.xp();
    return (await this.store.list()).map((r) => ({ ...r, level: levelInfo(r.xp, rules).level }));
  }

  update(userId: string, patch: BotPatch): Promise<'ok' | 'not_found'> {
    return this.store.update(userId, patch);
  }
}
