import type { AgeTrack } from '@dozari/shared';

/**
 * The app's two looks (owner, 2026-10-06; docs/logic/age-tracks.md): `play` is the candy look kid and teen players share,
 * `adult` is «صرافی و گاوصندوق» (docs/design/adult/). The look follows the player's track.
 */
export type ThemeId = 'play' | 'adult';

export const themeOf = (track: AgeTrack | null | undefined): ThemeId => (track === 'adult' ? 'adult' : 'play');

/** Adult palette (docs/design/CLAUDE.md, locked): near-black panels, gold frames, brass buttons, cream-gold text. */
export const adultColors = {
  bgTop: '#17100C',
  bgBottom: '#0E0A08',
  panel: '#17100C',
  frame: '#E8B64A',
  text: '#FFE9A8',
  textOnBrass: '#2A1606',
  brass: ['#FFF1B8', '#E8B64A', '#B8822A', '#8A5A16'],
  copper: '#C2693A',
  silver: '#C9CED6',
  danger: '#D6443A',
} as const;

/** Browser chrome of each look: installed-app manifest, tab/home-screen icons, address-bar colour. */
export const THEME_CHROME: Record<ThemeId, { manifest: string; icon: string; appleIcon: string; themeColor: string }> = {
  play: { manifest: '/manifest.webmanifest', icon: '/icon-192.png', appleIcon: '/apple-touch-icon.png', themeColor: '#2B1240' },
  adult: { manifest: '/manifest-adult.webmanifest', icon: '/icon-adult-192.png', appleIcon: '/apple-touch-icon-adult.png', themeColor: '#0E0A08' },
};

/** Adult metals (docs/design/CLAUDE.md): gold = primary/play, copper = duel/competition, silver = price guess, dark bronze = secondary, red = danger. */
const METAL = {
  gold: { light: '#FFF1B8', base: '#E8B64A', dark: '#B8822A', text: '#2A1606' },
  copper: { light: '#F0B48A', base: '#C2693A', dark: '#7A3A1A', text: '#FFF1DC' },
  silver: { light: '#F2F4F8', base: '#C9CED6', dark: '#8A909C', text: '#1E2128' },
  bronze: { light: '#B8822A', base: '#8A5A16', dark: '#5A3A12', text: '#FFE9A8' },
  red: { light: '#F08A80', base: '#D6443A', dark: '#8A2018', text: '#FFFFFF' },
} as const;

const METAL_OF_CANDY: Record<string, keyof typeof METAL> = {
  '#FFC93C': 'gold',
  '#7ED957': 'gold',
  '#FF7A3D': 'copper',
  '#FF4D8D': 'copper',
  '#3FC1F0': 'silver',
  '#E8B64A': 'gold',
  '#D9A441': 'gold',
  '#C2693A': 'copper',
  '#C9CED6': 'silver',
};

/** Face tones of a candy-coloured control in the given look: unchanged (text `#fff`) in play, a metal in adult. */
export function toneIn(theme: ThemeId, color: string, candy: { light: string; base: string; dark: string }): { light: string; base: string; dark: string; text: string } {
  if (theme === 'play') return { ...candy, text: '#fff' };
  return METAL[METAL_OF_CANDY[color.toUpperCase()] ?? 'bronze'];
}

/**
 * Global palette of each look (theme/colors.ts). Play is the candy palette; adult swaps the candy accents for metals and darkens the backdrop.
 * Puzzle group colours are locked in both. Chosen once at start (a theme change takes effect on the next start, the web reloads itself).
 */
export const PALETTES = {
  play: {
    bgTop: '#2A0E52',
    bgBottom: '#7A1E86',
    cream: '#FFF6E8',
    paper: '#FBF1DE',
    deep: '#3C1A66',
    deeper: '#4E2585',
    ink: '#2B1240',
    candy: { pink: '#FF4D8D', orange: '#FF7A3D', yellow: '#FFC93C', sky: '#3FC1F0', grape: '#A66BF0', lime: '#7ED957' },
    tone: {
      pink: { light: '#FF8FB6', base: '#FF4D8D', dark: '#B8235A' },
      orange: { light: '#FFAA7A', base: '#FF7A3D', dark: '#B9481A' },
      yellow: { light: '#FFE48A', base: '#FFC93C', dark: '#C48A0E' },
      sky: { light: '#8FDCFA', base: '#3FC1F0', dark: '#1478A8' },
      grape: { light: '#C9A3FF', base: '#A66BF0', dark: '#6634B0' },
      lime: { light: '#B8F08F', base: '#7ED957', dark: '#3F8F1F' },
    },
    tile: { idle: { face: '#FFF6E8', shelf: '#D9B98C', text: '#2B1240' }, selected: { face: '#6B35B8', shelf: '#3E1A78', text: '#FFFFFF' } },
  },
  adult: {
    bgTop: '#17100C',
    bgBottom: '#0E0A08',
    cream: '#F3DFA2',
    paper: '#E9D197',
    deep: '#24170F',
    deeper: '#3A2618',
    ink: '#2A1606',
    candy: { pink: '#C2693A', orange: '#B8822A', yellow: '#E8B64A', sky: '#C9CED6', grape: '#8A5A16', lime: '#D9A441' },
    tone: {
      pink: { light: '#F0B48A', base: '#C2693A', dark: '#7A3A1A' },
      orange: { light: '#E8C27A', base: '#B8822A', dark: '#6A4210' },
      yellow: { light: '#FFF1B8', base: '#E8B64A', dark: '#B8822A' },
      sky: { light: '#F2F4F8', base: '#C9CED6', dark: '#8A909C' },
      grape: { light: '#B8822A', base: '#8A5A16', dark: '#5A3A12' },
      lime: { light: '#FFE48A', base: '#D9A441', dark: '#8A5A16' },
    },
    tile: { idle: { face: '#FFE9A8', shelf: '#B8822A', text: '#2A1606' }, selected: { face: '#3A2416', shelf: '#120B07', text: '#FFE9A8' } },
  },
} as const;
