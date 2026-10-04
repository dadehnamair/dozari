import { levelClaimSchema, levelRoadSchema } from '@dozari/shared';
import type { LevelClaim, LevelRoad } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

export const fetchLevelRoad = (): Promise<LevelRoad> => session.authed(async (token) => levelRoadSchema.parse(await callJson('/me/levels', 'GET', undefined, token)));

/** Takes every reward the player has reached and not yet taken. */
export const claimLevelRewards = (): Promise<LevelClaim> => session.authed(async (token) => levelClaimSchema.parse(await callJson('/me/levels/claim', 'POST', undefined, token)));
