/** Makeup of the cosmetic pack («21 Cosmetic Packs»), ported from `MK` of docs/design/Character.dc.html. Face coordinates of the 200x260 sheet. */

const f1 = (v: number): string => v.toFixed(1);
const ell = (x: number, y: number, a: number, b: number): string => `M${x - a} ${y} a${a} ${b} 0 1 0 ${2 * a} 0 a${a} ${b} 0 1 0 ${-2 * a} 0Z`;
const star = (x: number, y: number, big: number, small: number, n = 5): string => {
  let s = '';
  for (let i = 0; i < 2 * n; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const q = i % 2 ? small : big;
    s += `${i ? 'L' : 'M'}${f1(x + q * Math.cos(a))} ${f1(y + q * Math.sin(a))} `;
  }
  return `${s}Z`;
};
const heart = (x: number, y: number, s: number): string =>
  `M${f1(x)} ${f1(y + s * 0.9)} C${f1(x - s * 1.4)} ${f1(y)} ${f1(x - s * 1.1)} ${f1(y - s * 1.1)} ${f1(x)} ${f1(y - s * 0.4)} C${f1(x + s * 1.1)} ${f1(y - s * 1.1)} ${f1(x + s * 1.4)} ${f1(y)} ${f1(x)} ${f1(y + s * 0.9)}Z`;

const CHEEKS = ell(75, 104, 12, 8) + ell(125, 104, 12, 8);
const SHADOW = ell(88, 71, 15, 16) + ell(112, 71, 15, 16);
const WING = 'M76 72 Q72 70 64 64 Q70 72 77 76Z M124 72 Q128 70 136 64 Q130 72 123 76Z';

export interface MakeupSpec {
  /** Blush: path and colour (drawn under the skin details). */
  blush?: string;
  blushColor?: string;
  /** Eyeshadow (only while the eyes are open). */
  shadow?: string;
  shadowColor?: string;
  /** Winged liner (only while the eyes are open). */
  liner?: string;
  /** Lipstick colour: strokes the mouth outline; `gloss` adds the white highlight. */
  lip?: string;
  gloss?: boolean;
  /** Painted shapes and dots on the face. */
  paint?: string;
  paintColor?: string;
  dots?: string;
  dotsColor?: string;
  dotsWidth?: number;
}

export const MAKEUP: Readonly<Record<string, MakeupSpec>> = {
  blush: { blush: CHEEKS, blushColor: '#FF6F9A' },
  lipRed: { lip: '#E8243C', gloss: true },
  lipPink: { lip: '#FF5FA0', gloss: true },
  lipPlum: { lip: '#8E2A6E' },
  shadowPurple: { shadow: SHADOW, shadowColor: '#B98AF5' },
  shadowGold: { shadow: SHADOW, shadowColor: '#FFC93C', dots: 'M70 60 h.1 M130 60 h.1 M76 56 h.1 M124 56 h.1', dotsColor: '#FFF6E8', dotsWidth: 3 },
  liner: { liner: WING },
  mole: { dots: 'M126 120 h.1', dotsColor: '#3A2418', dotsWidth: 5.5 },
  glitter: { paint: star(70, 106, 5, 2, 4) + star(130, 106, 5, 2, 4) + star(80, 112, 3.4, 1.4, 4) + star(120, 112, 3.4, 1.4, 4), paintColor: '#FFE48A', dots: 'M66 98 h.1 M134 98 h.1 M84 104 h.1 M116 104 h.1', dotsColor: '#FF8FB6', dotsWidth: 3.4 },
  stars: { paint: star(72, 104, 8, 3.6) + star(130, 102, 6, 2.7), paintColor: '#3FC1F0' },
  hearts: { paint: heart(73, 104, 5.5) + heart(127, 104, 5.5), paintColor: '#FF4D8D' },
  tiger: { paint: 'M56 98 L72 101 L57 104Z M58 108 L72 107 L60 113Z M144 98 L128 101 L143 104Z M142 108 L128 107 L140 113Z', paintColor: '#FF7A3D' },
  glam: { blush: CHEEKS, blushColor: '#FF6F9A', shadow: SHADOW, shadowColor: '#FFC93C', liner: WING, lip: '#E8243C', gloss: true, dots: 'M126 120 h.1', dotsColor: '#3A2418', dotsWidth: 5.5 },
};

/** The highlight on a glossy lip, relative to the mouth group. */
export const GLOSS = 'M93 128 q4 -2 8 -1';
