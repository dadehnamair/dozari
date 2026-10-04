import { searchCandidatesSchema } from '@dozari/shared';
import type { SearchCandidate } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

/** Is the player in a live match right now (a game they left or lost connection to)? */
export const fetchMatchActive = (): Promise<boolean> => session.authed(async (token) => ((await callJson('/match/active', 'GET', undefined, token)) as { active?: boolean }).active === true);

/** Faces for the opponent-search grid (online players, topped up with bots); empty on any failure so the screen keeps its placeholders. */
export const fetchCandidates = (): Promise<SearchCandidate[]> =>
  session.authed(async (token) => searchCandidatesSchema.parse(await callJson('/duel/candidates', 'GET', undefined, token)).candidates).catch(() => []);
