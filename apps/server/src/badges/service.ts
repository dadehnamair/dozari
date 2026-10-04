import { skillTier } from '@dozari/shared';
import type { Badge, ModError, MyBadges, Notice, PublicBadges, SkillRules, SkillTier } from '@dozari/shared';
import { tehranDayStart } from '@dozari/shared';
import type { SettingsService } from '../settings/service.js';
import type { BadgePerk, BadgeRow, BadgeStore, NoticeKind, NoticeRow, RuleMetric } from './store.js';

export interface ModRules {
  maxMuteMinutes: number;
  perDay: number;
}

export async function skillRulesFromSettings(settings: SettingsService): Promise<SkillRules> {
  const [minGames, proGames, proWinPercent] = await Promise.all(['skill.min_games', 'skill.pro_games', 'skill.pro_win_percent'].map((k) => settings.num(k)));
  return { minGames: minGames!, proGames: proGames!, proWinPercent: proWinPercent! };
}

export async function modRulesFromSettings(settings: SettingsService): Promise<ModRules> {
  const [maxMuteMinutes, perDay] = await Promise.all(['mod.max_mute_minutes', 'mod.agent_actions_per_day'].map((k) => settings.num(k)));
  return { maxMuteMinutes: maxMuteMinutes!, perDay: perDay! };
}

export interface PlayerFacts {
  games: number;
  wins: number;
  level: number;
}

const toBadge = (b: BadgeRow): Badge => ({ id: b.id, titleFa: b.titleFa, descriptionFa: b.descriptionFa, kind: b.kind, iconKey: b.iconKey, perk: b.perk });
const toNotice = (n: NoticeRow): Notice => ({ id: n.id, kind: n.kind, text: n.text, by: n.issuerType, createdAt: n.createdAt, read: n.readAt !== null });
const metricValue = (m: RuleMetric, f: PlayerFacts): number => (m === 'games' ? f.games : m === 'wins' ? f.wins : m === 'level' ? f.level : 0);

export type ActionResult = { ok: true } | { ok: false; error: ModError };

/** Badges and medals (automatic by rule or granted), perks, warnings and commendations, and the agent's short mutes. */
export class BadgeService {
  constructor(
    private readonly store: BadgeStore,
    private readonly facts: (userId: string) => Promise<PlayerFacts>,
    private readonly skillRules: () => Promise<SkillRules>,
    private readonly modRules: () => Promise<ModRules>,
    private readonly playerExists: (userId: string) => Promise<boolean>,
    private readonly now: () => number = Date.now,
    /** Tells the player in another channel (e.g. Bale); must not throw into the flow. */
    private readonly notify?: (userId: string, text: string) => void,
  ) {}

  /** Awards every automatic badge whose rule the player now meets; returns the newly awarded ones. Never throws into the game flow. */
  async evaluate(userId: string): Promise<Badge[]> {
    try {
      const [catalog, earned, f] = await Promise.all([this.store.catalog(), this.store.earned(userId), this.facts(userId)]);
      const have = new Set(earned.map((e) => e.badgeId));
      const fresh: Badge[] = [];
      for (const b of catalog) {
        if (b.ruleMetric === 'none' || have.has(b.id) || metricValue(b.ruleMetric, f) < b.ruleMin) continue;
        if (await this.store.award(userId, b.id, null)) {
          fresh.push(toBadge(b));
          this.notify?.(userId, `نشان تازه گرفتی: ${b.titleFa} 🏅`);
        }
      }
      return fresh;
    } catch {
      return [];
    }
  }

  async hasPerk(userId: string, perk: BadgePerk): Promise<boolean> {
    const [catalog, earned] = await Promise.all([this.store.catalog(), this.store.earned(userId)]);
    const have = new Set(earned.map((e) => e.badgeId));
    return catalog.some((b) => b.perk === perk && have.has(b.id));
  }

  async tierOf(userId: string): Promise<SkillTier> {
    const [f, rules] = await Promise.all([this.facts(userId), this.skillRules()]);
    return skillTier(f, rules);
  }

  async me(userId: string): Promise<MyBadges> {
    const [catalog, earned, equippedId, notices, mute, f, rules] = await Promise.all([
      this.store.catalog(),
      this.store.earned(userId),
      this.store.equippedId(userId),
      this.store.notices(userId, 30),
      this.store.activeMute(userId, this.now()),
      this.facts(userId),
      this.skillRules(),
    ]);
    const have = new Set(earned.map((e) => e.badgeId));
    const mine = catalog.filter((b) => have.has(b.id));
    return {
      earned: mine.map(toBadge),
      locked: catalog.filter((b) => !have.has(b.id) && b.ruleMetric !== 'none').map((b) => ({ ...toBadge(b), metric: b.ruleMetric, min: b.ruleMin, have: metricValue(b.ruleMetric, f) })),
      equippedId: equippedId && have.has(equippedId) ? equippedId : null,
      perks: { shareContact: mine.some((b) => b.perk === 'share_contact'), moderator: mine.some((b) => b.perk === 'moderator') },
      notices: notices.map(toNotice),
      muted: mute,
      skill: skillTier(f, rules),
    };
  }

  /** What anybody sees: the shown badge, up to 6 medals, the skill tier. */
  async publicOf(userId: string): Promise<PublicBadges> {
    const [catalog, earned, equippedId, tier] = await Promise.all([this.store.catalog(), this.store.earned(userId), this.store.equippedId(userId), this.tierOf(userId)]);
    const have = new Set(earned.map((e) => e.badgeId));
    const badge = catalog.find((b) => b.id === equippedId && have.has(b.id) && b.kind === 'badge');
    return { badge: badge ? toBadge(badge) : null, medals: catalog.filter((b) => b.kind === 'medal' && have.has(b.id)).slice(0, 6).map(toBadge), skill: tier };
  }

  /** Shows one earned badge next to the name, or none. False when the player does not own it. */
  async equip(userId: string, badgeId: string | null): Promise<boolean> {
    if (badgeId !== null && !(await this.store.earned(userId)).some((e) => e.badgeId === badgeId)) return false;
    await this.store.equip(userId, badgeId);
    return true;
  }

  async markNoticesRead(userId: string): Promise<void> {
    await this.store.markNoticesRead(userId);
  }

  async isMuted(userId: string): Promise<{ until: number; reason: string } | null> {
    return this.store.activeMute(userId, this.now());
  }

  // ---- admin side -------------------------------------------------------------------------------------------------

  async grant(userId: string, badgeId: string, by: string): Promise<boolean> {
    const b = (await this.store.catalog({ includeHidden: true })).find((x) => x.id === badgeId);
    if (!b) return false;
    const fresh = await this.store.award(userId, badgeId, by);
    if (fresh) this.notify?.(userId, `نشان تازه گرفتی: ${b.titleFa} 🏅`);
    return true;
  }

  revoke(userId: string, badgeId: string): Promise<boolean> {
    return this.store.revoke(userId, badgeId);
  }

  async issueNotice(userId: string, kind: NoticeKind, text: string, issuer: { type: 'admin' | 'agent'; id: string | null }): Promise<NoticeRow> {
    const n = await this.store.addNotice({ userId, kind, text, issuerType: issuer.type, issuerId: issuer.id });
    this.notify?.(userId, kind === 'warning' ? `اخطار: ${text}` : `تشویق: ${text} 👏`);
    return n;
  }

  async adminMute(userId: string, minutes: number, reason: string): Promise<void> {
    await this.store.setMute(userId, this.now() + minutes * 60_000, reason, 'admin', null);
  }

  clearMute(userId: string): Promise<void> {
    return this.store.clearMute(userId);
  }

  // ---- agent side («آجان دوزاری») --------------------------------------------------------------------------------

  private async checkAgent(agentId: string, targetId: string): Promise<ModError | null> {
    if (!(await this.hasPerk(agentId, 'moderator'))) return 'NOT_MODERATOR';
    if (agentId === targetId) return 'SELF';
    if (!(await this.playerExists(targetId))) return 'NOT_FOUND';
    if (await this.hasPerk(targetId, 'moderator')) return 'PROTECTED'; // agents do not act on each other; an admin can
    const rules = await this.modRules();
    if ((await this.store.actionsSince(agentId, tehranDayStart(this.now()))) >= rules.perDay) return 'LIMIT';
    return null;
  }

  async agentWarn(agentId: string, targetId: string, text: string): Promise<ActionResult> {
    const clean = text.trim();
    if ([...clean].length < 3 || [...clean].length > 200) return { ok: false, error: 'TEXT' };
    const err = await this.checkAgent(agentId, targetId);
    if (err) return { ok: false, error: err };
    await this.issueNotice(targetId, 'warning', clean, { type: 'agent', id: agentId });
    await this.store.logAction(agentId, targetId, 'warn', this.now());
    return { ok: true };
  }

  async agentMute(agentId: string, targetId: string, minutes: number, reason: string): Promise<ActionResult> {
    const clean = reason.trim();
    if ([...clean].length < 3 || [...clean].length > 150) return { ok: false, error: 'TEXT' };
    const rules = await this.modRules();
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > rules.maxMuteMinutes) return { ok: false, error: 'DURATION' };
    const err = await this.checkAgent(agentId, targetId);
    if (err) return { ok: false, error: err };
    await this.store.setMute(targetId, this.now() + minutes * 60_000, clean, 'agent', agentId);
    await this.store.logAction(agentId, targetId, 'mute', this.now());
    this.notify?.(targetId, `چند دقیقه در چت ساکت شدی: ${clean}`);
    return { ok: true };
  }
}
