/**
 * Where a cosmetic is worn. No imports on purpose: `packages/db/src/schema.ts` loads this file directly (drizzle-kit reads the schema
 * without a TypeScript-aware resolver, so it cannot follow the `.js` import paths of the rest of the package).
 */
export const COSMETIC_SLOTS = ['hat', 'outfit', 'accessory', 'hair', 'glasses', 'makeup'] as const;
export type CosmeticSlot = (typeof COSMETIC_SLOTS)[number];
