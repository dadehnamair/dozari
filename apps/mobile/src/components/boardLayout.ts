/** Pixel width of one card so `columns` cards plus gaps exactly fill `boardWidth` (0 until measured). */
export function cellWidth(boardWidth: number, gap: number, columns: number): number {
  if (boardWidth <= 0) return 0;
  return Math.floor((boardWidth - gap * (columns - 1)) / columns);
}
