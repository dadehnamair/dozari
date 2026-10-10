import { AD_PLACEMENTS, AD_PLACEMENT_DEFAULTS, AD_VIEW_MAX_AGE_SECONDS, dailyDateKey } from '@dozari/shared';
import type { AdCompleteError, AdOffer, AdPlacement, AdPlacementConfig, AdRewardKind, AdsStatus } from '@dozari/shared';

export interface AdPlacementRow extends AdPlacementConfig {
  placement: AdPlacement;
}

export interface AdPaid {
  rewardKind: AdRewardKind;
  rewardAmount: number;
  balance: number;
  gems: number;
}

/** I/O boundary of the rewarded ads. */
export interface AdsStore {
  /** Every known placement; a missing row reads as the shared default (and is created, so the admin can edit it). */
  placements(): Promise<AdPlacementRow[]>;
  updatePlacement(placement: AdPlacement, patch: Partial<AdPlacementConfig>): Promise<'ok' | 'not_found'>;
  /** Rewarded views on `day` and the start time of the latest view (any status) of this placement. */
  usage(userId: string, placement: AdPlacement, day: string): Promise<{ rewardedToday: number; lastStartedAt: number | null }>;
  /** Records a started view with the reward and watch time as they are now. */
  start(userId: string, placement: AdPlacement, day: string, cfg: AdPlacementConfig, at: number): Promise<string>;
  /**
   * Atomically turns a started view into a rewarded one and pays it (coins/gems through their ledgers, a hint token into the inventory, a wheel spin as a spin row).
   * Idempotent: a second claim of the same view pays nothing (`already`).
   */
  claim(userId: string, viewId: string, proof: string | null, at: number, maxAgeMs: number): Promise<{ ok: true; paid: AdPaid } | { ok: false; error: AdCompleteError }>;
}

export type AdStartResult = { ok: true; viewId: string; minWatchSeconds: number } | { ok: false; error: 'disabled' | 'capped' | 'cooldown' };

/**
 * Rewarded video ads (docs/logic/ads.md): the app asks to show one, the server hands out a view id, and after the ad the app claims it.
 * Which placements are on, what they pay and how often is data (`ad_placements`) behind one global switch (`ads.enabled`).
 * The adult-only wall is the request gate (`rewardedAds` track rule); the reward is always decided here, never by the client.
 */
export class AdsService {
  constructor(
    private readonly store: AdsStore,
    private readonly globalOn: () => Promise<boolean>,
    private readonly now: () => number = Date.now,
  ) {}

  /** Admin side of the placement table. */
  readonly placements = {
    list: () => this.store.placements(),
    update: (placement: AdPlacement, patch: Partial<AdPlacementConfig>) => this.store.updatePlacement(placement, patch),
  };

  private async live(placement: AdPlacement): Promise<AdPlacementConfig | null> {
    if (!(await this.globalOn())) return null;
    const row = (await this.store.placements()).find((p) => p.placement === placement);
    const cfg = row ?? { ...AD_PLACEMENT_DEFAULTS[placement] };
    return cfg.enabled && cfg.rewardAmount > 0 && cfg.dailyCap > 0 ? cfg : null;
  }

  async status(userId: string): Promise<AdsStatus> {
    if (!(await this.globalOn())) return { enabled: false, offers: [] };
    const rows = await this.store.placements();
    const day = dailyDateKey(this.now());
    const offers: AdOffer[] = [];
    for (const placement of AD_PLACEMENTS) {
      const cfg = rows.find((r) => r.placement === placement);
      if (!cfg || !cfg.enabled || cfg.rewardAmount <= 0 || cfg.dailyCap <= 0) continue;
      const u = await this.store.usage(userId, placement, day);
      const leftToday = cfg.dailyCap - u.rewardedToday;
      if (leftToday <= 0) continue;
      const cooldownLeft = u.lastStartedAt === null ? 0 : Math.max(0, Math.ceil((u.lastStartedAt + cfg.cooldownSeconds * 1000 - this.now()) / 1000));
      offers.push({ placement, rewardKind: cfg.rewardKind, rewardAmount: cfg.rewardAmount, leftToday, cooldownLeft });
    }
    return { enabled: true, offers };
  }

  async start(userId: string, placement: AdPlacement): Promise<AdStartResult> {
    const cfg = await this.live(placement);
    if (!cfg) return { ok: false, error: 'disabled' };
    const at = this.now();
    const day = dailyDateKey(at);
    const u = await this.store.usage(userId, placement, day);
    if (u.rewardedToday >= cfg.dailyCap) return { ok: false, error: 'capped' };
    if (u.lastStartedAt !== null && at - u.lastStartedAt < cfg.cooldownSeconds * 1000) return { ok: false, error: 'cooldown' };
    const viewId = await this.store.start(userId, placement, day, cfg, at);
    return { ok: true, viewId, minWatchSeconds: cfg.minWatchSeconds };
  }

  async complete(userId: string, viewId: string, proof?: string) {
    return this.store.claim(userId, viewId, proof ?? null, this.now(), AD_VIEW_MAX_AGE_SECONDS * 1000);
  }
}
