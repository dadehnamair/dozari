import { z } from 'zod';

/** One face in the opponent-search grid. Real online players and bots look the same (docs/logic/bots.md: no flag ever leaves the server). */
export const searchCandidateSchema = z.object({
  nickname: z.string(),
  avatarKey: z.string(),
  level: z.number().int().positive(),
});
export const searchCandidatesSchema = z.object({ candidates: z.array(searchCandidateSchema).max(16) });
export type SearchCandidate = z.infer<typeof searchCandidateSchema>;
/** Cards in the search grid (4 × 4). */
export const SEARCH_GRID_SIZE = 16;
