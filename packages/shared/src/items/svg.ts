import { ITEMS } from './data.js';

const INK = '#3A2418';
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Static SVG markup of an icon of the pack (same drawing as the app's `Item`, without the pencil wobble); unknown keys draw the coin. */
export function itemSvg(key: string): string {
  const def = ITEMS[key] ?? ITEMS.coin;
  const parts = (def?.p ?? [])
    .map(([d, f, a, b]) => {
      if (f === 'L') return `<path d="${d}" fill="none" stroke="${esc(b ?? INK)}" stroke-width="${Number(a)}"/>`;
      if (f === 'H') return `<path d="${d}" fill="none" stroke="#fff" stroke-width="2.4"/>`;
      return `<path d="${d}" fill="${esc(f)}" stroke="${a === 'N' ? 'none' : INK}" stroke-width="2.4"/>`;
    })
    .join('');
  const texts = (def?.t ?? []).map(([x, y, size, text, color]) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="Lalezar,Vazirmatn,sans-serif" font-size="${size}" fill="${esc(color)}" stroke="none">${esc(text)}</text>`).join('');
  return `<svg viewBox="-4 -4 72 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><g stroke="${INK}" stroke-linejoin="round" stroke-linecap="round"><ellipse cx="32" cy="63" rx="18" ry="2.6" fill="${INK}" opacity=".14" stroke="none"/>${parts}${texts}</g></svg>`;
}
