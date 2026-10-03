import { Platform } from 'react-native';

/**
 * Space above content on a phone with a notch / Dynamic Island. The iOS home-screen web app draws under the status bar
 * (`viewport-fit=cover` + `black-translucent`, public/index.html), so on the web the top padding grows by the device's
 * safe-area inset; native screens already get it from the OS, and a browser without a notch has an inset of 0.
 */
export const safeTop = (extra: number): number =>
  Platform.OS === 'web' ? (`calc(${extra}px + env(safe-area-inset-top, 0px))` as unknown as number) : extra;

/**
 * Top padding of a full-screen page (back button + title row). On the web the device's own inset (notch / status bar) is added by `safeTop`, so the
 * extra space can stay small and the header sits high; native screens keep the larger gap.
 */
export const PAGE_TOP_EXTRA = Platform.OS === 'web' ? 14 : 30;
export const pageTop = (): number => safeTop(PAGE_TOP_EXTRA);

/** The inset alone (for a container that sits above full-bleed art). */
export const safeInsetTop = (): number => safeTop(0);
