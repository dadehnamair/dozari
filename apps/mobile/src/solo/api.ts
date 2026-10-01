import { soloChartSchema, soloGuessResultSchema, soloViewSchema } from '@dozari/shared';
import type { SoloChart, SoloGuessResult, SoloView } from '@dozari/shared';

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`);
  }
}

async function call(path: string, method: 'GET' | 'POST', body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = typeof json === 'object' && json !== null && 'error' in json ? String((json as { error: unknown }).error) : 'error';
    throw new ApiError(res.status, code);
  }
  return json;
}

export const startSolo = async (): Promise<SoloView> => soloViewSchema.parse(await call('/solo/start', 'POST'));

export const guessSolo = async (sessionId: string, productIds: readonly string[]): Promise<SoloGuessResult> =>
  soloGuessResultSchema.parse(await call(`/solo/${sessionId}/guess`, 'POST', { productIds }));

export const shuffleSolo = async (sessionId: string): Promise<SoloView> =>
  soloViewSchema.parse(await call(`/solo/${sessionId}/shuffle`, 'POST'));

export const fetchSoloChart = async (sessionId: string): Promise<SoloChart> =>
  soloChartSchema.parse(await call(`/solo/${sessionId}/chart`, 'GET'));
