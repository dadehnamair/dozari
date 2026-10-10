/**
 * Rewarded video ads (docs/logic/ads.md, D221). The placements are fixed here (each one is wired to a screen in the app); whether a placement
 * is on, what it pays and how often is a row in `ad_placements`, edited in the admin panel. These are the defaults a missing row starts from;
 * everything starts OFF, and the global switch `ads.enabled` must also be on.
 */
export const AD_REWARD_KINDS = ['coins', 'gems', 'hint_token', 'wheel_spin'] as const;
export type AdRewardKind = (typeof AD_REWARD_KINDS)[number];

export const AD_PLACEMENTS = ['coins_short', 'coin_shop', 'wheel_extra'] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

export interface AdPlacementConfig {
  enabled: boolean;
  rewardKind: AdRewardKind;
  rewardAmount: number;
  /** Rewarded views per player per Tehran day (0 = none). */
  dailyCap: number;
  /** Seconds between two views of this placement for one player. */
  cooldownSeconds: number;
  /** The server refuses a reward claimed sooner than this after the view started. */
  minWatchSeconds: number;
}

export const AD_PLACEMENT_DEFAULTS: Record<AdPlacement, AdPlacementConfig> = {
  coins_short: { enabled: false, rewardKind: 'coins', rewardAmount: 30, dailyCap: 5, cooldownSeconds: 60, minWatchSeconds: 10 },
  coin_shop: { enabled: false, rewardKind: 'coins', rewardAmount: 20, dailyCap: 5, cooldownSeconds: 60, minWatchSeconds: 10 },
  wheel_extra: { enabled: false, rewardKind: 'wheel_spin', rewardAmount: 1, dailyCap: 2, cooldownSeconds: 120, minWatchSeconds: 10 },
};

export const AD_PLACEMENT_LABEL_FA: Record<AdPlacement, string> = {
  coins_short: 'کمبود سکه (ورود به میز یا دوئل)',
  coin_shop: 'فروشگاه سکه',
  wheel_extra: 'چرخش اضافه‌ی گردونه',
};

/** A started view must be claimed within this long, or it expires. */
export const AD_VIEW_MAX_AGE_SECONDS = 600;

export const AD_LIMITS = { rewardAmountMax: 100_000, dailyCapMax: 100, cooldownMax: 86_400, minWatchMax: 120 } as const;
