import { Platform } from 'react-native';

/**
 * Space above content on a phone with a notch / Dynamic Island. The iOS home-screen web app draws under the status bar
 * (`viewport-fit=cover` + `black-translucent`, public/index.html), so on the web the top padding grows by the device's
 * safe-area inset; native screens already get it from the OS, and a browser without a notch has an inset of 0.
 */
export const safeTop = (extra: number): number =>
  Platform.OS === 'web' ? (`calc(${extra}px + env(safe-area-inset-top, 0px))` as unknown as number) : extra;

/** The inset alone (for a container that sits above full-bleed art). */
export const safeInsetTop = (): number => safeTop(0);
