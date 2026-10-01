import { checkNickname, levelInfo, xpForGame } from '@dozari/shared';
import type { City, GameResultForXp, LevelInfo, NicknameProblem, NicknameRules, PlayerStats, XpRules } from '@dozari/shared';
import type { SettingsService } from '../settings/service.js';
import type { TextFilterService } from '../textfilter/service.js';
import type { PlayerStore } from './store.js';

export interface PlayerRules {
  xp: XpRules;
  nickname: NicknameRules;
  /** Finished games needed before a player may rename themselves. */
  nicknameUnlockGames: number;
  /** Renaming needs a redeemed invite code (an "activated" account). */
  renameNeedsInvite: boolean;
}

export const DEFAULT_RULES: PlayerRules = {
  xp: { soloBase: 5, duelBase: 10, winBonus: 15, curveBase: 50, levelMax: 50 },
  nickname: { minLen: 2, maxLen: 20, allowDigits: false, allowLatin: false, allowPersian: true },
  nicknameUnlockGames: 10,
  renameNeedsInvite: false,
};

export async function rulesFromSettings(settings: SettingsService): Promise<PlayerRules> {
  const [soloBase, duelBase, winBonus, curveBase, levelMax, minLen, maxLen, digits, latin, persian, unlock, needsInvite] = await Promise.all(
    ['xp.solo_base', 'xp.duel_base', 'xp.win_bonus', 'xp.curve_base', 'xp.level_max', 'nickname.min_len', 'nickname.max_len', 'nickname.allow_digits', 'nickname.allow_latin', 'nickname.allow_persian', 'profile.nickname_unlock_games', 'invite.required_for_rename'].map((k) => settings.num(k)),
  );
  return {
    xp: { soloBase: soloBase!, duelBase: duelBase!, winBonus: winBonus!, curveBase: curveBase!, levelMax: levelMax! },
    nickname: { minLen: minLen!, maxLen: Math.max(maxLen!, minLen!), allowDigits: digits === 1, allowLatin: latin === 1, allowPersian: persian === 1 },
    nicknameUnlockGames: unlock!,
    renameNeedsInvite: needsInvite === 1,
  };
}

export type RenameResult = { ok: true; nickname: string } | { ok: false; error: 'locked' | 'needs_invite' | 'filtered' | NicknameProblem; unlockGames?: number };
export type SimpleResult<E extends string> = { ok: true } | { ok: false; error: E };

const EMAIL = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

/** Stats and experience, city, e-mail and nickname of a player. The rules are read live from the admin settings. */
export class PlayerService {
  /** Called after a finished game was recorded (e.g. to pay an inviter); must not throw into the game flow. */
  afterGame?: (userId: string) => void | Promise<void>;

  constructor(
    private readonly store: PlayerStore,
    private readonly rules: () => Promise<PlayerRules> = async () => DEFAULT_RULES,
    private readonly filter?: TextFilterService,
    /** Has this player redeemed an invite code? Without it the invite rule is not enforced. */
    private readonly isActivated?: (userId: string) => Promise<boolean>,
  ) {}

  /** Records one finished game; never throws into the game flow. */
  async recordGame(userId: string, game: GameResultForXp): Promise<void> {
    try {
      const { xp } = await this.rules();
      await this.store.addGame(userId, game.outcome, xpForGame(game, xp));
      await this.afterGame?.(userId);
    } catch {
      /* stats must not break a finished game */
    }
  }

  async levelOf(userId: string): Promise<{ level: LevelInfo; stats: PlayerStats }> {
    const [row, rules] = await Promise.all([this.store.stats(userId), this.rules()]);
    return { level: levelInfo(row.xp, rules.xp), stats: { games: row.games, wins: row.wins, losses: row.losses, draws: row.draws } };
  }

  async cityOf(userId: string): Promise<City | null> {
    const { cityId } = await this.store.privateRow(userId);
    const c = cityId ? await this.store.city(cityId) : null;
    return c ? { id: c.id, nameFa: c.nameFa } : null;
  }

  async mine(userId: string) {
    const [lv, priv, rules] = await Promise.all([this.levelOf(userId), this.store.privateRow(userId), this.rules()]);
    const games = lv.stats.games;
    return { ...lv, city: await this.cityOf(userId), email: priv.email, nicknameRules: rules.nickname, nicknameLockedUntilGames: games >= rules.nicknameUnlockGames ? null : rules.nicknameUnlockGames };
  }

  async cities(): Promise<City[]> {
    return (await this.store.cities()).map((c) => ({ id: c.id, nameFa: c.nameFa }));
  }

  async setCity(userId: string, cityId: string | null): Promise<SimpleResult<'unknown_city'>> {
    if (cityId !== null) {
      const c = await this.store.city(cityId);
      if (!c || !c.isActive) return { ok: false, error: 'unknown_city' };
    }
    await this.store.setCity(userId, cityId);
    return { ok: true };
  }

  async setEmail(userId: string, raw: string | null): Promise<SimpleResult<'invalid_email'>> {
    const email = raw === null || raw.trim() === '' ? null : raw.trim().toLowerCase();
    if (email !== null && (email.length > 120 || !EMAIL.test(email))) return { ok: false, error: 'invalid_email' };
    await this.store.setEmail(userId, email);
    return { ok: true };
  }

  async setNickname(userId: string, raw: string): Promise<RenameResult> {
    const rules = await this.rules();
    if (rules.renameNeedsInvite && this.isActivated && !(await this.isActivated(userId))) return { ok: false, error: 'needs_invite' };
    const { stats } = await this.levelOf(userId);
    if (stats.games < rules.nicknameUnlockGames) return { ok: false, error: 'locked', unlockGames: rules.nicknameUnlockGames };
    const checked = checkNickname(raw, rules.nickname);
    if (!checked.ok) return { ok: false, error: checked.problem };
    if (this.filter) {
      const verdict = await this.filter.check(checked.value);
      if (!verdict.ok || verdict.text !== checked.value) return { ok: false, error: 'filtered' };
    }
    await this.store.setNickname(userId, checked.value);
    return { ok: true, nickname: checked.value };
  }
}
