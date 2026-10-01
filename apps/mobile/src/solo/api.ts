import { soloChartSchema, soloGuessResultSchema, soloPriceResultSchema, soloPriceRoundsSchema, soloViewSchema } from '@dozari/shared';
import type { SoloChart, SoloGuessResult, SoloPriceResult, SoloPriceRounds, SoloView } from '@dozari/shared';

import { ApiError, BASE_URL, callJson } from '../net/http';

export { ApiError, BASE_URL };

const call = callJson;

export const startSolo = async (token?: string): Promise<SoloView> => soloViewSchema.parse(await call('/solo/start', 'POST', undefined, token));

export const guessSolo = async (sessionId: string, productIds: readonly string[]): Promise<SoloGuessResult> =>
  soloGuessResultSchema.parse(await call(`/solo/${sessionId}/guess`, 'POST', { productIds }));

export const shuffleSolo = async (sessionId: string): Promise<SoloView> =>
  soloViewSchema.parse(await call(`/solo/${sessionId}/shuffle`, 'POST'));

export const fetchSoloChart = async (sessionId: string): Promise<SoloChart> =>
  soloChartSchema.parse(await call(`/solo/${sessionId}/chart`, 'GET'));

export const fetchPriceRounds = async (sessionId: string): Promise<SoloPriceRounds> =>
  soloPriceRoundsSchema.parse(await call(`/solo/${sessionId}/price-rounds`, 'GET'));

export const guessPrice = async (sessionId: string, level: number, guessRials: bigint): Promise<SoloPriceResult> =>
  soloPriceResultSchema.parse(await call(`/solo/${sessionId}/price-guess`, 'POST', { level, guessRials: guessRials.toString() }));
