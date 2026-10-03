import { Platform } from 'react-native';

/**
 * The app's layout is the web design's on every platform: the layout direction stays left-to-right (RTL is switched off
 * natively, see App.tsx and plugins/) and Persian right-to-left order is written out explicitly, so a phone behaves exactly
 * like the browser whatever the device language. A row that should read right-to-left uses `ROW`; numbers, phone fields and
 * codes keep a plain `'row'` and read left-to-right.
 */
export const ROW = 'row-reverse' as const;

/**
 * `textAlign` for Persian text that starts on the right. The web's `right` is physical; Android's `right` means "the end of
 * the paragraph", which for Persian text is the left edge, so on a phone the paragraph's start (`left`) is the right edge.
 */
export const TEXT_START = Platform.OS === 'web' ? ('right' as const) : ('left' as const);
