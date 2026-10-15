import type { AgeTrack, Gender } from '@dozari/shared';
import { applyTrackTheme } from './themeStore';

/**
 * The player's look = theme (candy or adult), decided by track. The launcher/PWA icon is one fixed adult icon for everyone (owner, 2026-10-15), so it never switches.
 * Gender and track arrive from different calls, so the last known value of each is kept and every change re-applies both.
 */
let gender: Gender | null | undefined;
let track: AgeTrack | null | undefined;

function apply(): void {
  applyTrackTheme(track);
}

export function setLookGender(g: Gender | null | undefined): void {
  gender = g;
  apply();
}

/** The last known gender of the player (set when Home loads the profile), for screens that draw the hero. */
export const getLookGender = (): Gender | null | undefined => gender;

/** `null` (feature off or lookup failed) falls back to the candy look. */
export function setLookTrack(t: AgeTrack | null | undefined): void {
  track = t;
  apply();
}
