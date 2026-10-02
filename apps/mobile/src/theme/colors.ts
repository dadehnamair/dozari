/** Candy Arcade v3 (docs/brand-visual.md, docs/design/Dozari Visual Assets.dc.html). Group colours are locked. */
export const colors = {
  bgTop: '#2A0E52',
  bgBottom: '#7A1E86',
  panel: 'rgba(255,255,255,0.14)',
  cream: '#FFF6E8',
  ink: '#2B1240',
  candy: { pink: '#FF4D8D', orange: '#FF7A3D', yellow: '#FFC93C', sky: '#3FC1F0', grape: '#A66BF0', lime: '#7ED957' },
  group: ['#F9DF6D', '#A0C35A', '#B0C4EF', '#BA81C5'],
} as const;

/** Each candy colour as light highlight / base / dark shelf, as drawn in the design kit. */
export const candyTone = {
  pink: { light: '#FF8FB6', base: '#FF4D8D', dark: '#B8235A' },
  orange: { light: '#FFAA7A', base: '#FF7A3D', dark: '#B9481A' },
  yellow: { light: '#FFE48A', base: '#FFC93C', dark: '#C48A0E' },
  sky: { light: '#8FDCFA', base: '#3FC1F0', dark: '#1478A8' },
  grape: { light: '#C9A3FF', base: '#A66BF0', dark: '#6634B0' },
  lime: { light: '#B8F08F', base: '#7ED957', dark: '#3F8F1F' },
} as const;

/** Light / base / dark of a candy base colour; any other colour gets a neutral set. */
export function toneOf(color: string): { light: string; base: string; dark: string } {
  const hit = Object.values(candyTone).find((t) => t.base === color);
  return hit ?? { light: color, base: color, dark: 'rgba(0,0,0,0.28)' };
}

/** Shelf (bottom edge) colour of each locked group colour, yellow to purple. */
export const groupShelf = ['#C9A92A', '#6E9030', '#6F88C4', '#8A4F98'] as const;

/** Board tiles: cream when idle, deep grape when selected. */
export const tile = {
  idle: { face: '#FFF6E8', shelf: '#D9B98C', text: '#2B1240' },
  selected: { face: '#6B35B8', shelf: '#3E1A78', text: '#FFFFFF' },
} as const;

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
