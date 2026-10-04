import type { CosmeticSlot } from './hints-contract.js';

/** Every wearable the character can draw (D165/D176): `iconKey` of a cosmetic shop item names one of these, and the slot it fits. */
export const WEAR_SLOT_OF: Readonly<Record<string, CosmeticSlot>> = {
  shapoo: 'hat', crown: 'hat', beanie: 'hat',
  hairLong: 'hair', hairCurly: 'hair', hairBun: 'hair',
  glassesRound: 'glasses', glassesSun: 'glasses',
  shirt: 'outfit', dress: 'outfit',
  scarf: 'accessory',
};

/** Keys saved before the art existed (`hat` was a generic icon). */
const WEAR_ALIAS: Readonly<Record<string, string>> = { hat: 'shapoo' };

export const wearKey = (key: string | null | undefined): string | null => (key ? (WEAR_ALIAS[key] ?? key) : null);
export const isWearKey = (key: string): boolean => WEAR_SLOT_OF[wearKey(key) ?? ''] !== undefined;
