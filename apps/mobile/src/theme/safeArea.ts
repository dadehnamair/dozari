import { Platform, StatusBar } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

/**
 * Space above content on a phone with a notch / Dynamic Island. The iOS home-screen web app draws under the status bar
 * (`viewport-fit=cover` + `black-translucent`, public/index.html), so on the web the top padding grows by the device's
 * safe-area inset. On Android the app draws edge-to-edge (the art fills the screen under the status bar), so content is
 * pushed down by the status bar height instead; the backgrounds stay full-bleed. A browser without a notch has an inset of 0.
 */
/** The real status-bar / notch height of this device: Android's status bar, an iPhone's safe-area top (no guess); 0 on the web, where `env(safe-area-inset-top)` does it. */
export const nativeTopInset = (): number => (Platform.OS === 'android' ? (StatusBar.currentHeight ?? Math.round(initialWindowMetrics?.insets.top ?? 0)) : Platform.OS === 'ios' ? Math.round(initialWindowMetrics?.insets.top ?? 0) : 0);

export const safeTop = (extra: number): number =>
  Platform.OS === 'web' ? (`calc(${extra}px + env(safe-area-inset-top, 0px))` as unknown as number) : extra + nativeTopInset();

/**
 * Top padding of a full-screen page (back button + title row): a small fixed gap plus the device's own inset (notch / status bar), read from
 * the device on every platform, so no page leaves an empty strip above its header.
 */
export const PAGE_TOP_EXTRA = 8;
export const pageTop = (): number => safeTop(PAGE_TOP_EXTRA);

/** The web inset alone, for the app container (native screens keep full-bleed art and pad their own content with `nativeTopInset`). */
export const safeInsetTop = (): number => (Platform.OS === 'web' ? safeTop(0) : 0);
