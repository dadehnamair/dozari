/** Candy colours of the card backs (the design's palette) and how many motifs there are. */
export const BACK_TONES = ['#FF4D8D', '#3FC1F0', '#FFC93C', '#A66BF0', '#7ED957', '#FF7A3D'] as const;
export const BACK_MOTIFS = 9;

/** Stable small number out of a card id, so a card keeps its colour and motif while the grid changes. */
export function backSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}
