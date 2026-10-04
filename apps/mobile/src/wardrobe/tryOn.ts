import { COSMETIC_SLOTS } from '@dozari/shared';
import type { CosmeticSlot, ShopItem } from '@dozari/shared';
import type { Worn } from '../components/wearArt';

/** What the player is trying on in the fitting room: slot -> item id, or null for «nothing in this slot». A missing slot shows what is really worn. */
export type Tried = Partial<Record<CosmeticSlot, string | null>>;

export const cosmeticsOf = (items: readonly ShopItem[]): ShopItem[] => items.filter((i) => i.effect === 'cosmetic' && i.slot !== null);
export const inSlot = (items: readonly ShopItem[], slot: CosmeticSlot): ShopItem[] => cosmeticsOf(items).filter((i) => i.slot === slot);

/** The item id shown in a slot right now: the one being tried, else the one really worn. */
export function shownIn(items: readonly ShopItem[], tried: Tried, slot: CosmeticSlot): string | null {
  const t = tried[slot];
  if (t !== undefined) return t;
  return inSlot(items, slot).find((i) => i.equipped)?.id ?? null;
}

/** What the character on the stage wears. */
export function previewWorn(items: readonly ShopItem[], tried: Tried): Worn[] {
  const out: Worn[] = [];
  for (const slot of COSMETIC_SLOTS) {
    const id = shownIn(items, tried, slot);
    const it = id ? inSlot(items, slot).find((i) => i.id === id) : undefined;
    if (it) out.push({ slot, iconKey: it.iconKey });
  }
  return out;
}

/** Tapping an item tries it on; tapping the one already shown takes it off in the preview. */
export function toggleTry(items: readonly ShopItem[], tried: Tried, it: ShopItem): Tried {
  if (!it.slot) return tried;
  return { ...tried, [it.slot]: shownIn(items, tried, it.slot) === it.id ? null : it.id };
}

export const isTrying = (tried: Tried): boolean => Object.keys(tried).length > 0;

/** What the main button of a tried item does. `locked` shows the guide's reason instead of buying. */
export type TryAction = 'takeOff' | 'wear' | 'locked' | 'free' | 'buy';

export function actionFor(it: ShopItem): TryAction {
  if (it.owned) return it.equipped ? 'takeOff' : 'wear';
  if (it.blocked !== null) return 'locked';
  return priceOf(it) === 0 ? 'free' : 'buy';
}

export const priceOf = (it: ShopItem): number => (it.currency === 'gems' ? it.priceGems : it.priceCoins);
