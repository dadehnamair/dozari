import { tournamentDetailSchema, tournamentListSchema, tournamentTurnResponseSchema } from '@dozari/shared';
import type { TournamentDetail, TournamentListItem, TournamentTurn } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

const authed = <T>(path: string, method: 'GET' | 'POST', parse: (v: unknown) => T): Promise<T> => session.authed(async (token) => parse(await callJson(path, method, undefined, token)));

export const fetchTournaments = (): Promise<TournamentListItem[]> => authed('/tournaments', 'GET', (v) => tournamentListSchema.parse(v).tournaments);
export const fetchTournament = (id: string): Promise<TournamentDetail> => authed(`/tournaments/${id}`, 'GET', (v) => tournamentDetailSchema.parse(v));
export const joinTournament = (id: string): Promise<void> => authed(`/tournaments/${id}/join`, 'POST', () => undefined);
export const leaveTournament = (id: string): Promise<void> => authed(`/tournaments/${id}/leave`, 'POST', () => undefined);
export const fetchTurn = (): Promise<TournamentTurn | null> => authed('/me/tournament-turn', 'GET', (v) => tournamentTurnResponseSchema.parse(v).turn);
export const checkInTournament = (id: string): Promise<void> => authed(`/tournaments/${id}/checkin`, 'POST', () => undefined);
