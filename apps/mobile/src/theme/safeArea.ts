import { Platform, StatusBar } from 'react-native';

/**
 * Space above content on a phone with a notch / Dynamic Island. The iOS home-screen web app draws under the status bar
 * (`viewport-fit=cover` + `black-translucent`, public/index.html), so on the web the top padding grows by the device's
 * safe-area inset. On Android the app draws edge-to-edge (the art fills the screen under the status bar), so content is
 * pushed down by the status bar height instead; the backgrounds stay full-bleed. A browser without a notch has an inset of 0.
 */
export const nativeTopInset = (): number => (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0);

export const safeTop = (extra: number): number =>
  Platform.OS === 'web' ? (`calc(${extra}px + env(safe-area-inset-top, 0px))` as unknown as number) : extra + nativeTopInset();

/**
 * Top padding of a full-screen page (back button + title row). On the web the device's own inset (notch / status bar) is added by `safeTop`, so the
 * extra space can stay small and the header sits high; Android adds its status bar height the same way, iOS keeps the larger gap.
 */
export const PAGE_TOP_EXTRA = Platform.OS === 'ios' ? 30 : 14;
export const pageTop = (): number => safeTop(PAGE_TOP_EXTRA);

/** The web inset alone, for the app container (native screens keep full-bleed art and pad their own content with `nativeTopInset`). */
export const safeInsetTop = (): number => (Platform.OS === 'web' ? safeTop(0) : 0);
