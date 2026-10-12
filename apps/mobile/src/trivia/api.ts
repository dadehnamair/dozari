import { triviaTopicsSchema, triviaViewSchema, triviaResultSchema } from '@dozari/shared';
import type { TriviaResult, TriviaTopics, TriviaView } from '@dozari/shared';
import { z } from 'zod';
import { session } from '../auth';
import { ApiError, callJson } from '../net/http';

const answerSchema = z.object({ result: triviaResultSchema, view: triviaViewSchema });

/** Runs a call as the signed-in guest; falls back to anonymous play if sign-in fails (same as the price-only mode). */
async function authedOrAnonymous<T>(run: (token?: string) => Promise<T>): Promise<T> {
  try {
    return await session.authed((token) => run(token));
  } catch (err) {
    if (err instanceof ApiError) throw err;
    return run();
  }
}

export const fetchTriviaTopics = (): Promise<TriviaTopics> => authedOrAnonymous(async (token) => triviaTopicsSchema.parse(await callJson('/trivia/topics', 'GET', undefined, token)));

/** Starts a game on one topic, or a mix of topics when `topicId` is absent. */
export const beginTrivia = (topicId?: string): Promise<TriviaView> => authedOrAnonymous(async (token) => triviaViewSchema.parse(await callJson('/trivia/start', 'POST', topicId ? { topicId } : {}, token)));

export const answerTrivia = async (sessionId: string, index: number, picked: number): Promise<{ result: TriviaResult; view: TriviaView }> =>
  answerSchema.parse(await callJson(`/trivia/${sessionId}/answer`, 'POST', { index, picked }));
