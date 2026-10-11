import { keepsakeGallerySchema, showcaseViewSchema } from '@dozari/shared';
import type { KeepsakeGallery, ShowcaseView } from '@dozari/shared';
import { session } from '../auth';
import { ApiError, callJson } from '../net/http';

export const fetchGallery = (): Promise<KeepsakeGallery> =>
  session.authed(async (token) => keepsakeGallerySchema.parse(await callJson('/keepsakes', 'GET', undefined, token)));

export interface PieceResult {
  /** Collection milestones this purchase paid. */
  milestones?: { count: number; gems: number; spins: number }[];
  piece: number;
  completed: boolean;
  gems: number;
  setCompleted: boolean;
  balance: number;
}

/** What a failed purchase / upgrade says: not enough coins, already complete, unknown or at the top level. */
export type KeepsakeError = 'insufficient' | 'complete' | 'unknown' | 'not_complete' | 'max' | 'duplicate';

async function post<T>(path: string): Promise<{ ok: true; value: T } | { ok: false; error: KeepsakeError }> {
  try {
    return { ok: true, value: await session.authed((token) => callJson(path, 'POST', undefined, token) as Promise<T>) };
  } catch (err) {
    if (err instanceof ApiError && [402, 404, 409].includes(err.status)) return { ok: false, error: (err.code as KeepsakeError | undefined) ?? 'unknown' };
    throw err;
  }
}

export const buyPiece = (id: string) => post<PieceResult>(`/keepsakes/${id}/piece`);
export const upgradeKeepsake = (id: string) => post<{ level: number; balance: number }>(`/keepsakes/${id}/upgrade`);

export const saveShowcase = (ids: string[]): Promise<ShowcaseView> =>
  session.authed(async (token) => showcaseViewSchema.parse(await callJson('/me/showcase', 'PUT', { ids }, token)));

export const fetchShowcase = (playerId: string): Promise<ShowcaseView> =>
  session.authed(async (token) => showcaseViewSchema.parse(await callJson(`/players/${playerId}/showcase`, 'GET', undefined, token)));
