import { Platform } from 'react-native';
import type { TextInputProps } from 'react-native';

/**
 * `textAlign` for a phone. The layout is right-to-left there (`I18nManager`), and in an RTL layout Android reads `left` and
 * `right` the other way round, while the web (a left-to-right layout) reads them literally. The styles are written for the
 * web, so these two give the same result on both: `TEXT_RIGHT` is the right edge (Persian text), `TEXT_LEFT` the left edge
 * (codes, e-mail, phone numbers).
 */
export const TEXT_RIGHT = Platform.OS === 'web' ? ('right' as const) : ('left' as const);
export const TEXT_LEFT = Platform.OS === 'web' ? ('left' as const) : ('right' as const);

/**
 * Props that make a Persian text field right-to-left on every platform: the caret, the placeholder and the «…» of a long text sit on the
 * right edge. (On the web the page is left-to-right, so `textAlign` alone leaves the ellipsis and the caret on the wrong side.)
 */
export const RTL_INPUT = { props: { dir: 'rtl' } as unknown as TextInputProps, style: { writingDirection: 'rtl' as const, textAlign: TEXT_RIGHT } };

/**
 * Absolute-position keys for a screen edge, for the same reason: in the phone's RTL layout `right:` is read as the left edge,
 * so `[EDGE_RIGHT]: 0` pins a box to the right edge of the screen on every platform.
 */
export const EDGE_RIGHT = Platform.OS === 'web' ? ('right' as const) : ('left' as const);
export const EDGE_LEFT = Platform.OS === 'web' ? ('left' as const) : ('right' as const);

/** Rounds the two corners on the screen's left edge (the right corners of an RTL phone layout read the other way round). */
export const roundLeftEdge = (r: number) =>
  Platform.OS === 'web' ? { borderTopLeftRadius: r, borderBottomLeftRadius: r } : { borderTopRightRadius: r, borderBottomRightRadius: r };
