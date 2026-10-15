import { bootTheme } from './bootTheme';
import { colors } from './colors';
import { useTheme } from './themeStore';

/** Dark panels of the adult look («صرافی و گاوصندوق»): near-black panel, gold frame, cream-gold text (docs/design/CLAUDE.md). */
export const DARK = {
  panel: '#17100C',
  raised: '#24170F',
  field: '#0E0A08',
  frame: '#E8B64A',
  text: '#FFE9A8',
  sub: 'rgba(255,233,168,0.72)',
  line: 'rgba(232,182,74,0.28)',
} as const;

/** True in the adult look: sheets and pages paint dark panels with light text instead of cream with ink. */
export function useDark(): boolean {
  return useTheme() === 'adult';
}

/** The look the palette was built with (fixed at start, like `colors`), usable in static style sheets. */
const ADULT_BOOT = bootTheme() === 'adult';

/**
 * Text on a candy-coloured face: white with an ink shadow in the play look; in the adult look the faces are brass and silver,
 * so the text turns dark and loses the shadow (a dark shadow under dark text only smears it). Spread it last in the text style.
 */
export const FACE_TEXT = ADULT_BOOT ? ({ color: '#2A1606', textShadowColor: 'transparent', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 0 } as const) : ({} as const);

/** Text lying straight on a dark scene (splash, backdrops): ink in play where scenes are light, cream-gold with a black shadow in adult. */
export const SCENE_TEXT = ADULT_BOOT ? ({ color: '#FFE9A8', textShadowColor: '#000', textShadowRadius: 2 } as const) : ({} as const);

/** Icon colour on the yellow back/close squares: ink in play; cream-gold in adult, where the square is dark bronze and ink would vanish on it. */
export const ON_YELLOW = ADULT_BOOT ? '#FFE9A8' : colors.ink;

const SKIN_BG: Record<string, string> = {
  [colors.paper.toLowerCase()]: '#201610',
  [colors.cream.toLowerCase()]: '#201610',
  [colors.card.toLowerCase()]: '#17100C',
  [colors.candy.yellow.toLowerCase()]: '#5A3A1C',
  '#e8f9d8': '#1C3A12',
  '#fff3c4': '#3A2A0A',
  '#8fdcfa': '#2A1E16',
  '#ffe48a': '#5A3A1C',
  '#8bdb4b': '#3E7A22',
};
const SKIN_TEXT: Record<string, string> = {
  [colors.ink.toLowerCase()]: '#FFE9A8',
  '#7e46d6': '#E8B64A',
  '#5a3a7a': 'rgba(255,233,168,0.8)',
  '#b3261e': '#FF9A8A',
  '#2e7d32': '#9FE870',
  '#9a8a7a': 'rgba(255,233,168,0.4)',
};

/**
 * Re-colours a screen's style sheet for the adult look: cream / paper cards become dark plates, ink text becomes cream-gold, ink borders
 * become bronze, violet / dark-red / dark-green accents lighten. A no-op in the play look. For form-like screens whose layout needs no redesign.
 */
export function adultSkin<T extends Record<string, object>>(styles: T): T {
  if (!ADULT_BOOT) return styles;
  const out: Record<string, object> = {};
  for (const [k, v] of Object.entries(styles)) {
    const s: Record<string, unknown> = { ...v };
    const bg = typeof s.backgroundColor === 'string' ? SKIN_BG[s.backgroundColor.toLowerCase()] : undefined;
    if (bg) s.backgroundColor = bg;
    const fg = typeof s.color === 'string' ? SKIN_TEXT[s.color.toLowerCase()] : undefined;
    if (fg) s.color = fg;
    if (typeof s.borderColor === 'string' && s.borderColor.toLowerCase() === colors.ink.toLowerCase()) s.borderColor = '#8A5A16';
    out[k] = s;
  }
  return out as T;
}
