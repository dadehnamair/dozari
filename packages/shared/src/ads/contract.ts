import { z } from 'zod';
import { AD_PLACEMENTS, AD_REWARD_KINDS } from '../config/ads.js';

export const adPlacementSchema = z.enum(AD_PLACEMENTS);
export const adRewardKindSchema = z.enum(AD_REWARD_KINDS);

/** One placement the player can use right now (off, capped-out or cooling-down placements are simply absent from `offers`). */
export const adOfferSchema = z.object({
  placement: adPlacementSchema,
  rewardKind: adRewardKindSchema,
  rewardAmount: z.number().int(),
  leftToday: z.number().int(),
  /** Seconds until the next view is allowed; 0 = now. */
  cooldownLeft: z.number().int(),
});
export type AdOffer = z.infer<typeof adOfferSchema>;

/** `GET /ads` */
export const adsStatusSchema = z.object({ enabled: z.boolean(), offers: z.array(adOfferSchema) });
export type AdsStatus = z.infer<typeof adsStatusSchema>;

/** `POST /ads/start` */
export const adStartBodySchema = z.object({ placement: adPlacementSchema });
export const adStartOkSchema = z.object({ viewId: z.string(), minWatchSeconds: z.number().int() });
export const AD_START_ERRORS = ['disabled', 'capped', 'cooldown'] as const;

/** `POST /ads/complete` */
export const adCompleteBodySchema = z.object({ viewId: z.string().min(1).max(64), proof: z.string().max(400).optional() });
export const adCompleteOkSchema = z.object({ ok: z.literal(true), rewardKind: adRewardKindSchema, rewardAmount: z.number().int(), balance: z.number().int(), gems: z.number().int() });
export const AD_COMPLETE_ERRORS = ['not_found', 'already', 'too_early', 'expired'] as const;
export type AdCompleteError = (typeof AD_COMPLETE_ERRORS)[number];
