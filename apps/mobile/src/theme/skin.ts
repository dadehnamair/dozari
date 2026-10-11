import { bootTheme } from './bootTheme';
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
