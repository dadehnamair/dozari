import { myAgeTrackSchema } from '@dozari/shared';
import type { AgeTrack, MyAgeTrackDto } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

export const fetchAgeTrack = (): Promise<MyAgeTrackDto> => session.authed(async (token) => myAgeTrackSchema.parse(await callJson('/me/age-track', 'GET', undefined, token)));

export const saveAgeTrack = (track: AgeTrack): Promise<MyAgeTrackDto> =>
  session.authed(async (token) => myAgeTrackSchema.parse(await callJson('/me/age-track', 'PUT', { track }, token)));

/**
 * Should the one-time «who is playing?» screen show? Only when the server switch is on and this account was never asked.
 * Any failure (offline, server error) reads as «no», so the screen can never block a player from the game.
 */
export async function ageTrackNeeded(settings: Record<string, unknown>): Promise<boolean> {
  if (settings['feature.age_tracks'] !== 1) return false;
  try {
    const mine = await fetchAgeTrack();
    return mine.enabled && !mine.chosen;
  } catch {
    return false;
  }
}
