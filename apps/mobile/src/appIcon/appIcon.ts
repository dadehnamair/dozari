import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { AgeTrack, Gender } from '@dozari/shared';

/**
 * Launcher icon variants (D165 + age themes): the original hero, the female hero, and the same two on the adult gold-and-black coin.
 * Kid and teen keep the original candy icons; adult is the default until a kid/teen track is known.
 */
export type IconVariant = 'default' | 'female' | 'adult' | 'adultFemale';

export const iconFor = (gender: Gender | null | undefined, track?: AgeTrack | null): IconVariant =>
  track === 'kid' || track === 'teen' ? (gender === 'female' ? 'female' : 'default') : gender === 'female' ? 'adultFemale' : 'adult';

interface AppIconModule {
  setIcon(variant: IconVariant): void;
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
