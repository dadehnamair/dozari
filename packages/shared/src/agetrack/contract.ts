import { z } from 'zod';
import { AGE_TRACKS } from '../config/ageTracks.js';

export const ageTrackSchema = z.enum(AGE_TRACKS);

/** `GET /me/age-track` and the answer of `PUT /me/age-track` (docs/logic/age-tracks.md). */
const trackRulesSchema = z.object({
  priceGuess: z.boolean(),
  coinWager: z.boolean(),
  wordLesson: z.boolean(),
  freeTextChat: z.enum(['invite_code', 'guardian_switch']),
  socialSameTrackOnly: z.boolean(),
  socialNeedsGuardian: z.boolean(),
  purchases: z.boolean(),
  ugc: z.boolean(),
  publicCity: z.boolean(),
  dailyPuzzle: z.boolean(),
  priceOnly: z.boolean(),
  lookup: z.boolean(),
  puzzleTracks: z.array(ageTrackSchema),
  tauntTrack: ageTrackSchema,
});
export type TrackRulesDto = z.infer<typeof trackRulesSchema>;

export const myAgeTrackSchema = z.object({
  enabled: z.boolean(),
  track: ageTrackSchema,
  chosen: z.boolean(),
  rules: trackRulesSchema,
});
export type MyAgeTrackDto = z.infer<typeof myAgeTrackSchema>;

export const ageTrackPutSchema = z.object({ track: ageTrackSchema });
