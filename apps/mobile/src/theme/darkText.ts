/** Perceived brightness (0 dark … 1 light) of `#rgb`, `#rrggbb` or `rgb(a)(…)`; null for anything else (named, transparent, platform colours). */
export function brightnessOf(color: unknown): number | null {
  if (typeof color !== 'string') return null;
  let r: number;
  let g: number;
  let b: number;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    const h = hex[1]!.length === 3 ? hex[1]!.replace(/./g, (c) => c + c) : hex[1]!;
    [r, g, b] = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  } else {
    const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(color);
    if (!rgb) return null;
    [r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Dark text under a shadow only smears: shadows are for light text on a busy backdrop. */
export function smearsDarkText(flat: { color?: unknown; textShadowColor?: unknown } | undefined | null): boolean {
  if (!flat || flat.textShadowColor === undefined || flat.textShadowColor === 'transparent') return false;
  const b = brightnessOf(flat.color);
  return b !== null && b < 0.4;
}
