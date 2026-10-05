import { lessonsResponseSchema } from '@dozari/shared';
import type { LessonCard } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

/** The approved word-lesson cards for these items; items without a lesson are simply missing from the answer. */
export const fetchLessons = (productIds: readonly string[]): Promise<LessonCard[]> =>
  session.authed(async (token) => lessonsResponseSchema.parse(await callJson('/lessons', 'POST', { productIds: productIds.slice(0, 16) }, token)).lessons);
