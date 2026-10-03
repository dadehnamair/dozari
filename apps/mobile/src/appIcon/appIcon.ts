import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { Gender } from '@dozari/shared';

/** Launcher icon variants (D165): the original hero, or the female hero for players who chose «female». */
export type IconVariant = 'default' | 'female';

export const iconFor = (gender: Gender | null | undefined): IconVariant => (gender === 'female' ? 'female' : 'default');

interface AppIconModule {
  setIcon(variant: IconVariant): void;
}

/** Switches the home-screen icon (Android; elsewhere, or in a build without the native module, it does nothing). Never throws. */
export function applyAppIcon(gender: Gender | null | undefined): void {
  if (Platform.OS !== 'android') return;
  try {
    requireOptionalNativeModule<AppIconModule>('DozariAppIcon')?.setIcon(iconFor(gender));
  } catch {
    /* the icon is a nicety */
  }
}
