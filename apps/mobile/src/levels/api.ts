import { levelRoadSchema } from '@dozari/shared';
import type { LevelRoad } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

export const fetchLevelRoad = (): Promise<LevelRoad> => session.authed(async (token) => levelRoadSchema.parse(await callJson('/me/levels', 'GET', undefined, token)));
