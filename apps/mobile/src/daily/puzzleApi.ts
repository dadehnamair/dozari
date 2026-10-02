import { dailyStatusSchema } from '@dozari/shared';
import type { DailyStatus } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

export const fetchDailyStatus = (): Promise<DailyStatus> => session.authed(async (token) => dailyStatusSchema.parse(await callJson('/daily-puzzle', 'GET', undefined, token)));
