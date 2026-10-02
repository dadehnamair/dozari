import { session } from '../auth';
import { callJson } from '../net/http';

/** Is the player in a live match right now (a game they left or lost connection to)? */
export const fetchMatchActive = (): Promise<boolean> => session.authed(async (token) => ((await callJson('/match/active', 'GET', undefined, token)) as { active?: boolean }).active === true);
