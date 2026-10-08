/** The designer's seven-segment «camera date» imprint (`docs/design/yadegar/Yadegar.dc.html`), right-aligned at (288, 386) of the 300×400 photo. */
const SEG: Record<string, [number, number, number, number]> = { a: [1, 0, 6, 1.6], b: [6.4, 0.8, 1.6, 6], c: [6.4, 7.6, 1.6, 6], d: [1, 13, 6, 1.6], e: [0, 7.6, 1.6, 6], f: [0, 0.8, 1.6, 6], g: [1, 6.6, 6, 1.6] };
const DIG: Record<string, string> = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcfgd' };

export interface Seg {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rectangles drawing the date text, e.g. `'89 11 07`. */
export function dateSegments(text: string): Seg[] {
  const out: Seg[] = [];
  let x = 288;
  for (const ch of text.split('').reverse()) {
    if (ch === ' ') {
      x -= 6;
      continue;
    }
    if (ch === "'") {
      x -= 4;
      out.push({ x, y: 372, w: 1.6, h: 4 });
      continue;
    }
    x -= 10;
    for (const k of DIG[ch] ?? '') {
      const [sx, sy, w, h] = SEG[k]!;
      out.push({ x: x + sx, y: 372 + sy, w, h });
    }
  }
  return out;
}
