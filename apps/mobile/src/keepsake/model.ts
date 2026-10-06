import { SHOWCASE_MAX } from '@dozari/shared';
import type { KeepsakeGallery, KeepsakeRarity, KeepsakeView } from '@dozari/shared';

/** Frame colour of each rarity (the designer's art replaces the placeholder inside the frame, not the frame). */
export const RARITY_COLOR: Record<KeepsakeRarity, string> = { common: '#B8F08F', rare: '#8FDCFA', epic: '#C9A3FF', legendary: '#FFC93C' };

export interface Section {
  key: string;
  title: string | null;
  completed: number;
  total: number;
  items: KeepsakeView[];
}

/** The gallery as sections: one per set (in the server's order), then the keepsakes that belong to none. Empty sets are left out. */
export function sections(g: Pick<KeepsakeGallery, 'items' | 'sets'>, loose: string): Section[] {
  const out: Section[] = g.sets
    .map((s) => ({ key: s.id, title: s.titleFa, completed: s.completed, total: s.total, items: g.items.filter((i) => i.setId === s.id) }))
    .filter((s) => s.items.length > 0);
  const known = new Set(g.sets.map((s) => s.id));
  const rest = g.items.filter((i) => i.setId === null || !known.has(i.setId));
  if (rest.length > 0) out.push({ key: 'loose', title: loose, completed: rest.filter((i) => i.complete).length, total: rest.length, items: rest });
  return out;
}

/** Which action the card's button does right now. */
export type Action = 'buy' | 'upgrade' | 'max';
export const actionOf = (k: Pick<KeepsakeView, 'complete' | 'upgradePrice'>): Action => (!k.complete ? 'buy' : k.upgradePrice === null ? 'max' : 'upgrade');
export const priceOf = (k: Pick<KeepsakeView, 'complete' | 'piecePrice' | 'upgradePrice'>): number | null => (!k.complete ? k.piecePrice : k.upgradePrice);

/** Toggles a keepsake on the showcase: appended at the end, removed when pinned, and refused (same list) when the showcase is full. */
export function togglePin(current: readonly string[], id: string): string[] {
  if (current.includes(id)) return current.filter((x) => x !== id);
  return current.length >= SHOWCASE_MAX ? [...current] : [...current, id];
}

/** The ids on the showcase, in order, read from the gallery. */
export const pinnedIds = (items: readonly KeepsakeView[]): string[] =>
  items.filter((i) => i.showcaseSlot !== null).sort((a, b) => a.showcaseSlot! - b.showcaseSlot!).map((i) => i.id);
