import { HINT_KINDS } from '../config/economy.js';
import type { Rng } from '../game/rng.js';

export { HINT_KINDS };
export type HintKind = (typeof HINT_KINDS)[number];

export interface HintRules {
  prices: Readonly<Record<HintKind, number>>;
  minLevel: number;
  maxPerGame: number;
  /** Percent of the listed price charged from the 2nd hint of a game on. */
  repeatPercent: number;
}

/** What a hint reveals. Never more than one card, a pair, or a title (the solution stays server-side). */
export type HintPayload =
  | { kind: 'group_title'; level: number; titleFa: string }
  | { kind: 'one_card'; level: number; productId: string }
  | { kind: 'pair'; level: number; productIds: [string, string] };

export type HintBlock = 'LEVEL' | 'LIMIT';

export function hintPrice(kind: HintKind, usedInGame: number, rules: HintRules): number {
  const base = rules.prices[kind];
  return usedInGame === 0 ? base : Math.ceil((base * rules.repeatPercent) / 100);
}

/** May this player take another hint right now? */
export function hintBlock(level: number, usedInGame: number, rules: HintRules): HintBlock | null {
  if (level < rules.minLevel) return 'LEVEL';
  if (usedInGame >= rules.maxPerGame) return 'LIMIT';
  return null;
}

export interface HintGroup {
  level: number;
  titleFa: string;
  productIds: readonly string[];
}

/**
 * Picks what the next hint of this kind reveals, or null when nothing new is left to reveal. The easiest unsolved group
 * is used first; a card or title already revealed is never repeated. Pure: the rng only chooses among cards.
 */
export function pickHint(kind: HintKind, groups: readonly HintGroup[], solvedLevels: readonly number[], given: readonly HintPayload[], rng: Rng): HintPayload | null {
  const open = [...groups].filter((g) => !solvedLevels.includes(g.level)).sort((a, b) => a.level - b.level);
  const shown = (level: number) => new Set(given.flatMap((h) => (h.level !== level ? [] : h.kind === 'one_card' ? [h.productId] : h.kind === 'pair' ? h.productIds : [])));
  for (const g of open) {
    if (kind === 'group_title') {
      if (!given.some((h) => h.kind === 'group_title' && h.level === g.level)) return { kind, level: g.level, titleFa: g.titleFa };
      continue;
    }
    const hidden = g.productIds.filter((id) => !shown(g.level).has(id));
    const need = kind === 'pair' ? 2 : 1;
    if (hidden.length < need) continue;
    const pool = [...hidden];
    const take = (): string => pool.splice(Math.floor(rng() * pool.length), 1)[0] as string;
    return kind === 'pair' ? { kind, level: g.level, productIds: [take(), take()] } : { kind, level: g.level, productId: take() };
  }
  return null;
}
