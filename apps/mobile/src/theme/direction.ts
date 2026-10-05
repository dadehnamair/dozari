import { Platform } from 'react-native';

/**
 * `textAlign` for a phone. The layout is right-to-left there (`I18nManager`), and in an RTL layout Android reads `left` and
 * `right` the other way round, while the web (a left-to-right layout) reads them literally. The styles are written for the
 * web, so these two give the same result on both: `TEXT_RIGHT` is the right edge (Persian text), `TEXT_LEFT` the left edge
 * (codes, e-mail, phone numbers).
 */
export const TEXT_RIGHT = Platform.OS === 'web' ? ('right' as const) : ('left' as const);
export const TEXT_LEFT = Platform.OS === 'web' ? ('left' as const) : ('right' as const);
