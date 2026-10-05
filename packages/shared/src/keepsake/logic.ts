import {
  KEEPSAKE_DROP_CHANCE,
  KEEPSAKE_MAX_LEVEL,
  KEEPSAKE_PIECE_SHOP_PRICE,
  KEEPSAKE_PRICE_PERCENT,
  KEEPSAKE_RARITY_WEIGHT,
  KEEPSAKE_UPGRADE_COST,
  SHOWCASE_MAX,
  type KeepsakeRarity,
} from '../config/economy.js';
import { mulberry32 } from '../game/index.js';

/** What the pure rules need to know about a keepsake definition. */
export interface KeepsakeDef {
  id: string;
  rarity: KeepsakeRarity;
  /** Number of pieces (1..pieces are numbered). */
  pieces: number;
}

/** A player's progress on one keepsake: the piece numbers owned (no duplicates exist: a drop or a purchase is always a missing piece). */
export interface KeepsakeProgress {
  owned: readonly number[];
}

export const isComplete = (def: KeepsakeDef, p: KeepsakeProgress | undefined): boolean => (p?.owned.length ?? 0) >= def.pieces;

/** Piece numbers the player still lacks. */
export function missingPieces(def: KeepsakeDef, p: KeepsakeProgress | undefined): number[] {
  const have = new Set(p?.owned ?? []);
  return Array.from({ length: def.pieces }, (_, i) => i + 1).filter((n) => !have.has(n));
}

/** Coins for one piece in the shop, by rarity (integer rials-free coins, rounded). */
export const piecePrice = (rarity: KeepsakeRarity): number => Math.round((KEEPSAKE_PIECE_SHOP_PRICE * KEEPSAKE_PRICE_PERCENT[rarity]) / 100);

/** Coins to take a completed keepsake from `level` to `level + 1`; null at the top level. */
export const upgradeCost = (level: number): number | null => (level >= KEEPSAKE_MAX_LEVEL ? null : KEEPSAKE_UPGRADE_COST * level);

/** FNV-1a 32-bit hash: a stable seed from a string key. */
export function seedFrom(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export interface Drop {
  keepsakeId: string;
  piece: number;
}

/**
 * The piece (if any) one human win drops. Deterministic per `seedKey` (`<matchId>:<userId>`), so settling twice never changes the answer.
 * Chance `KEEPSAKE_DROP_CHANCE`; the keepsake is picked by rarity weight among those the player has not completed; the piece is one
 * the player lacks, so a drop is never a duplicate.
 */
export function rollDrop(defs: readonly KeepsakeDef[], progress: ReadonlyMap<string, KeepsakeProgress>, seedKey: string, chance: number = KEEPSAKE_DROP_CHANCE): Drop | null {
  const rng = mulberry32(seedFrom(seedKey));
  if (rng() >= chance) return null;
  const open = defs.filter((d) => !isComplete(d, progress.get(d.id)));
  if (open.length === 0) return null;
  const total = open.reduce((n, d) => n + KEEPSAKE_RARITY_WEIGHT[d.rarity], 0);
  let r = rng() * total;
  const pick = open.find((d) => (r -= KEEPSAKE_RARITY_WEIGHT[d.rarity]) < 0) ?? open[open.length - 1]!;
  const lacking = missingPieces(pick, progress.get(pick.id));
  return { keepsakeId: pick.id, piece: lacking[Math.floor(rng() * lacking.length)]! };
}

/** The piece a shop purchase gives: a missing one, picked deterministically from `seedKey` (the purchase id); null when the keepsake is complete. */
export function shopPiece(def: KeepsakeDef, p: KeepsakeProgress | undefined, seedKey: string): number | null {
  const lacking = missingPieces(def, p);
  if (lacking.length === 0) return null;
  return lacking[Math.floor(mulberry32(seedFrom(seedKey))() * lacking.length)]!;
}

/** A showcase is up to `SHOWCASE_MAX` distinct completed keepsakes. Returns the cleaned list or null when it is not acceptable. */
export function cleanShowcase(ids: readonly string[], completed: ReadonlySet<string>): string[] | null {
  if (ids.length > SHOWCASE_MAX || new Set(ids).size !== ids.length) return null;
  return ids.every((id) => completed.has(id)) ? [...ids] : null;
}

/** Share of the active keepsakes a player has completed, 0..100 (whole percent). */
export const completionPercent = (completed: number, total: number): number => (total <= 0 ? 0 : Math.floor((completed * 100) / total));
