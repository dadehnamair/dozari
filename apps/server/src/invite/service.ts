import { generateInviteCode, looksLikeInviteCode, normalizeInviteCode } from '@dozari/shared';
import type { MyInvite, Rng } from '@dozari/shared';
import type { SettingsService } from '../settings/service.js';
import { RateLimiter } from '../security/rate-limit.js';
import type { InviteStore, RedeemOutcome } from './store.js';

export interface InviteRules {
  minLevel: number;
  maxUses: number;
  inviteeBonus: number;
  inviterReward: number;
  rewardAfterGames: number;
}

export async function inviteRulesFromSettings(settings: SettingsService): Promise<InviteRules> {
  const [minLevel, maxUses, inviteeBonus, inviterReward, rewardAfterGames] = await Promise.all(
    ['invite.min_level', 'invite.max_uses', 'invite.invitee_bonus', 'invite.inviter_reward', 'invite.reward_after_games'].map((k) => settings.num(k)),
  );
  return { minLevel: minLevel!, maxUses: maxUses!, inviteeBonus: inviteeBonus!, inviterReward: inviterReward!, rewardAfterGames: rewardAfterGames! };
}

export type RedeemResponse = Extract<RedeemOutcome, { ok: true }> | { ok: false; error: Extract<RedeemOutcome, { ok: false }>['error'] | 'rate_limited' };

/** Invite ("gold") codes: issued from a level, limited uses, redeemed once per player, inviter paid after the invitee has played. */
export class InviteService {
  // Guessing codes is the abuse to stop: 8 tries per 10 minutes per player.
  private readonly attempts = new RateLimiter(8, 10 * 60_000);

  constructor(
    private readonly store: InviteStore,
    private readonly rules: () => Promise<InviteRules>,
    private readonly levelOf: (userId: string) => Promise<number>,
    private readonly gamesOf: (userId: string) => Promise<number>,
    private readonly rng: Rng,
  ) {}

  async mine(userId: string): Promise<MyInvite> {
    const [rules, level, activated, counts] = await Promise.all([this.rules(), this.levelOf(userId), this.store.isActivated(userId), this.store.counts(userId)]);
    let row = await this.store.ownCode(userId);
    if (!row && level >= rules.minLevel) {
      for (let i = 0; i < 8 && !row; i++) {
        const made = await this.store.createCode(generateInviteCode(this.rng), userId, null, rules.maxUses);
        if (made !== 'taken') row = made;
        else row = await this.store.ownCode(userId); // another request created it first
      }
    }
    return {
      code: row?.code ?? null,
      minLevel: rules.minLevel,
      level,
      uses: row?.uses ?? 0,
      maxUses: row?.maxUses ?? rules.maxUses,
      rewarded: counts.rewarded,
      pending: counts.pending,
      activated,
      rules: { inviteeBonus: rules.inviteeBonus, inviterReward: rules.inviterReward, rewardAfterGames: rules.rewardAfterGames },
    };
  }

  async redeem(userId: string, raw: string): Promise<RedeemResponse> {
    if (!this.attempts.take(userId)) return { ok: false, error: 'rate_limited' };
    const code = normalizeInviteCode(raw);
    if (!looksLikeInviteCode(code)) return { ok: false, error: 'invalid' };
    const rules = await this.rules();
    const out = await this.store.redeem(userId, code, rules.inviteeBonus);
    return out;
  }

  /** Call after a player finishes a game: pays the inviter once the invitee has played enough. Never throws into the game flow. */
  async settle(inviteeId: string): Promise<void> {
    try {
      const rules = await this.rules();
      if ((await this.gamesOf(inviteeId)) < rules.rewardAfterGames) return;
      await this.store.payInviter(inviteeId, rules.inviterReward);
    } catch {
      /* the reward is retried after the invitee's next game */
    }
  }

  isActivated(userId: string): Promise<boolean> {
    return this.store.isActivated(userId);
  }
}
