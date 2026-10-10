import { PALETTES } from './appTheme';
import { bootTheme } from './bootTheme';

/** Candy Arcade v3 (docs/brand-visual.md, docs/design/Dozari Visual Assets.dc.html). Group colours are locked. */
const P = PALETTES[bootTheme()];

export const colors = {
  bgTop: P.bgTop,
  bgBottom: P.bgBottom,
  panel: 'rgba(255,255,255,0.14)',
  cream: P.cream,
  /** Light sheet/panel surface: soft cream in play, aged parchment in adult (dark text stays readable on both). */
  paper: P.paper,
  /** White cards/inputs, selection highlight, lavender tint and page sand — parchment tones in the adult look. */
  card: P.card,
  hi: P.hi,
  tint: P.tint,
  sand: P.sand,
  /** Dark purple surfaces (chips, bars) — near-black brown in adult. */
  deep: P.deep,
  deeper: P.deeper,
  ink: P.ink,
  candy: P.candy,
  group: ['#F9DF6D', '#A0C35A', '#B0C4EF', '#BA81C5'],
} as const;

/** Each candy colour as light highlight / base / dark shelf, as drawn in the design kit (metals in the adult look). */
export const candyTone = P.tone;

/** Light / base / dark of a candy base colour; any other colour gets a neutral set. */
export function toneOf(color: string): { light: string; base: string; dark: string } {
  const hit = Object.values(candyTone).find((t) => t.base === color);
  return hit ?? { light: color, base: color, dark: 'rgba(0,0,0,0.28)' };
}

/** Shelf (bottom edge) colour of each locked group colour, yellow to purple. */
export const groupShelf = ['#C9A92A', '#6E9030', '#6F88C4', '#8A4F98'] as const;

/** Board tiles: cream when idle, deep grape when selected (gold and black in the adult look). */
export const tile = P.tile;

/** Shelf colour for a candy base colour (falls back to a translucent dark edge for any other colour). */
export function shelfOf(color: string): string {
  const hit = Object.values(candyTone).find((t) => t.base === color);
  return hit ? hit.dark : 'rgba(0,0,0,0.28)';
}

export const fonts = {
  display: 'Lalezar_400Regular',
  body: 'Vazirmatn_400Regular',
  bold: 'Vazirmatn_700Bold',
} as const;
