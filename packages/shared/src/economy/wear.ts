import type { CosmeticSlot } from './hints-contract.js';
import { GENERATED_WEAR_SLOT_OF } from './wear-generated.js';

/** The wearables drawn in code (D165/D176). */
export const BUILT_IN_WEAR_SLOT_OF: Readonly<Record<string, CosmeticSlot>> = {
  shapoo: 'hat', crown: 'hat', beanie: 'hat',
  hairLong: 'hair', hairCurly: 'hair', hairBun: 'hair',
  glassesRound: 'glasses', glassesSun: 'glasses',
  shirt: 'outfit', dress: 'outfit',
  scarf: 'accessory',
};

/**
 * Every wearable the character can draw: `iconKey` of a cosmetic shop item names one of these, and the slot it fits.
 * Art drawn as an SVG file (apps/mobile/assets/wear, pnpm --filter @dozari/mobile wear:build) adds keys or redraws built-in ones.
 */
export const WEAR_SLOT_OF: Readonly<Record<string, CosmeticSlot>> = { ...BUILT_IN_WEAR_SLOT_OF, ...GENERATED_WEAR_SLOT_OF };

/** Keys saved before the art existed (`hat` was a generic icon). */
const WEAR_ALIAS: Readonly<Record<string, string>> = { hat: 'shapoo' };

export const wearKey = (key: string | null | undefined): string | null => (key ? (WEAR_ALIAS[key] ?? key) : null);
export const isWearKey = (key: string): boolean => WEAR_SLOT_OF[wearKey(key) ?? ''] !== undefined;
