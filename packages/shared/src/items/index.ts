export { ITEMS } from './data.js';
export type { ItemText, Part } from './data.js';
import { ITEMS } from './data.js';

/** Keys of the hand-drawn item / product icon pack (docs/design/Item.dc.html). Products reference one by `icon_key`. */
export const ITEM_ICON_KEYS: readonly string[] = Object.keys(ITEMS);

export function isItemIconKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(ITEMS, key);
}
