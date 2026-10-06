import type { AgeTrack, Gender } from '@dozari/shared';
import { applyAppIcon } from '../appIcon/appIcon';
import { applyTrackTheme } from './themeStore';

/**
 * The player's look = theme (candy or adult) + launcher icon, both decided by track, the icon also by gender.
 * Gender and track arrive from different calls, so the last known value of each is kept and every change re-applies both.
 */
let gender: Gender | null | undefined;
let track: AgeTrack | null | undefined;

function apply(): void {
  applyTrackTheme(track);
  applyAppIcon(gender, track);
}

export function setLookGender(g: Gender | null | undefined): void {
  gender = g;
  apply();
}

/** `null` (feature off or lookup failed) falls back to the candy look. */
export function setLookTrack(t: AgeTrack | null | undefined): void {
  track = t;
  apply();
}
