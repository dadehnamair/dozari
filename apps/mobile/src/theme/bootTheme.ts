import type { ThemeId } from './appTheme';

/** Device key of the remembered look (written by themeStore). */
export const THEME_KEY = 'dozari.theme.v1';

let booted: ThemeId = 'play';

/**
 * The look the palette (theme/colors.ts) was built with. It must be set before any screen module is imported (index.ts awaits
 * `setBootTheme` first), because StyleSheets read the palette once, when their module loads.
 */
export const bootTheme = (): ThemeId => booted;
export const setBootTheme = (t: ThemeId): void => {
  booted = t;
};
