import { workshopCardSchema, workshopInfoSchema, workshopMineRowSchema, workshopTopSchema, workshopTopicSchema } from '@dozari/shared';
import type { WorkshopCard, WorkshopInfo, WorkshopMineRow, WorkshopSubmit } from '@dozari/shared';
import { z } from 'zod';
import { session } from '../auth';
import { callJson } from '../net/http';

const authed = <T>(path: string, method: 'GET' | 'POST', parse: (v: unknown) => T, body?: unknown): Promise<T> =>
  session.authed(async (token) => parse(await callJson(path, method, body, token)));

export const fetchWorkshop = (): Promise<WorkshopInfo> => authed('/workshop', 'GET', (v) => workshopInfoSchema.parse(v));

const topicsSchema = z.object({ topics: z.array(workshopTopicSchema) });
export type WorkshopTopic = z.infer<typeof workshopTopicSchema>;
export const fetchWorkshopTopics = (): Promise<WorkshopTopic[]> => authed('/workshop/topics', 'GET', (v) => topicsSchema.parse(v).topics);

export const submitQuestion = (q: WorkshopSubmit): Promise<{ id: string }> => authed('/workshop/submissions', 'POST', (v) => z.object({ id: z.string() }).parse(v), q);

export const fetchMine = (): Promise<WorkshopMineRow[]> => authed('/workshop/mine', 'GET', (v) => z.object({ submissions: z.array(workshopMineRowSchema) }).parse(v).submissions);

export type ReviewFeed = { locked: true; need: number } | { locked: false; capped: boolean; card: WorkshopCard | null };
const feedSchema = z.union([z.object({ locked: z.literal(true), need: z.number() }), z.object({ locked: z.literal(false), capped: z.boolean(), card: workshopCardSchema.nullable() })]);
export const fetchReviewFeed = (): Promise<ReviewFeed> => authed('/workshop/review', 'GET', (v) => feedSchema.parse(v));

export const sendReview = (id: string, answerIndex: number, quality: 1 | -1): Promise<{ status: string; points: number }> =>
  authed(`/workshop/review/${id}`, 'POST', (v) => z.object({ status: z.string(), points: z.number() }).parse(v), { answerIndex, quality });

export const fetchTop = (period: 'week' | 'all') => authed(`/workshop/top?period=${period}`, 'GET', (v) => workshopTopSchema.parse(v));
