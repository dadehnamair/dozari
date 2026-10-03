/** Pixel width of one card so `columns` cards plus gaps exactly fill `boardWidth` (0 until measured). */
export function cellWidth(boardWidth: number, gap: number, columns: number): number {
  if (boardWidth <= 0) return 0;
  return Math.floor((boardWidth - gap * (columns - 1)) / columns);
}

export interface CardMetrics {
  height: number;
  icon: number;
  nameSize: number;
  unitSize: number;
}

/** Smallest name font, in px; below it the name ends in an ellipsis instead of shrinking further. */
export const NAME_FLOOR = 10;

/** Vertical padding inside a card (top + bottom), px. */
export const CARD_PAD = 8;
const LINE = 1.4;

/**
 * One measured layout per card width: the icon takes ~32% of the card height, the unit one small line,
 * and the name the remaining space as 2 lines (font derived from it, floor `NAME_FLOOR`, then it
 * auto-shrinks / ellipsises). Nothing spills out of the box.
 */
export function cardMetrics(w: number): CardMetrics {
  const height = w;
  const icon = Math.max(22, Math.round(height * 0.32));
  const unitSize = Math.max(9, Math.min(11, Math.round(w * 0.13)));
  const unitLine = Math.ceil(unitSize * LINE);
  const free = height - CARD_PAD - icon - unitLine;
  let nameSize = 14;
  while (nameSize > NAME_FLOOR && Math.ceil(nameSize * LINE) * 2 > free) nameSize -= 1;
  return { height, icon, nameSize, unitSize };
}
