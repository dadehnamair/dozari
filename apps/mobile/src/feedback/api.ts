import { feedCardSchema } from '@dozari/shared';
import type { FeedCard, ReportCategory, SubmissionInput } from '@dozari/shared';
import { z } from 'zod';
import { session } from '../auth';
import { callJson } from '../net/http';

const authed = <T>(path: string, method: 'GET' | 'POST', parse: (v: unknown) => T, body?: unknown): Promise<T> =>
  session.authed(async (token) => parse(await callJson(path, method, body, token)));

export const reportUser = (targetId: string, category: ReportCategory, details: string): Promise<void> => authed('/reports', 'POST', () => undefined, { targetId, category, details });

export const submitSuggestion = (input: SubmissionInput): Promise<{ id: string }> => authed('/ugc/submissions', 'POST', (v) => v as { id: string }, input);

export type Feed = { locked: true; need: number } | { locked: false; card: FeedCard | null };
const feedSchema = z.union([z.object({ locked: z.literal(true), need: z.number() }), z.object({ locked: z.literal(false), card: feedCardSchema.nullable() })]);
export const fetchFeed = (): Promise<Feed> => authed('/ugc/feed', 'GET', (v) => feedSchema.parse(v));

export const voteOn = (id: string, value: 1 | -1): Promise<void> => authed(`/ugc/${id}/vote`, 'POST', () => undefined, { value });
