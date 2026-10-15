import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { AgeTrack, Gender } from '@dozari/shared';

/**
 * Launcher icon variants: the adult-vault icon pair (owner, 2026-10-15) — male and female hero — for every age track.
 * The icon follows the player's gender only; the track no longer changes it (the kid/teen candy icons are retired).
 */
export type IconVariant = 'adult' | 'adultFemale';

export const iconFor = (gender: Gender | null | undefined, _track?: AgeTrack | null): IconVariant => (gender === 'female' ? 'adultFemale' : 'adult');

interface AppIconModule {
  setIcon(variant: IconVariant): void;
  restart(): void;
}

/** Switches the home-screen icon (Android; elsewhere, or in a build without the native module, it does nothing). Never throws. */
export function applyAppIcon(gender: Gender | null | undefined, track?: AgeTrack | null): void {
  if (Platform.OS !== 'android') return;
  try {
    requireOptionalNativeModule<AppIconModule>('DozariAppIcon')?.setIcon(iconFor(gender, track));
  } catch {
    /* the icon is a nicety */
  }
}

/** Closes the app and opens it again (Android): the launcher only shows the new icon after the switch, so a gender change restarts. Never throws. */
export function restartApp(): void {
  if (Platform.OS !== 'android') return;
  try {
    requireOptionalNativeModule<AppIconModule>('DozariAppIcon')?.restart();
  } catch {
    /* the player can reopen it by hand */
  }
}
