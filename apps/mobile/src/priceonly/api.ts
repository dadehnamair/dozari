import { priceOnlyResultSchema, priceOnlyViewSchema } from '@dozari/shared';
import type { PriceOnlyResult, PriceOnlyView } from '@dozari/shared';
import { z } from 'zod';
import { session } from '../auth';
import { ApiError, callJson } from '../net/http';

const answerSchema = z.object({ result: priceOnlyResultSchema, view: priceOnlyViewSchema });

/** Starts a price-only game as the signed-in guest; falls back to anonymous play if sign-in fails. */
export async function beginPriceOnly(): Promise<PriceOnlyView> {
  const run = async (token?: string) => priceOnlyViewSchema.parse(await callJson('/price-only/start', 'POST', undefined, token));
  try {
    return await session.authed((token) => run(token));
  } catch (err) {
    if (err instanceof ApiError) throw err;
    return run();
  }
}

export const guessPriceOnly = async (sessionId: string, index: number, guessRials: bigint): Promise<{ result: PriceOnlyResult; view: PriceOnlyView }> =>
  answerSchema.parse(await callJson(`/price-only/${sessionId}/guess`, 'POST', { index, guessRials: guessRials.toString() }));
