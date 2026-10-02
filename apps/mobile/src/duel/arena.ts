import { ENTRY_FEE_BASE, HOUSE_CUT_PERCENT, MATCH_MAX_MISTAKES, winnerPayout } from '@dozari/shared';
import type { MatchView } from '@dozari/shared';
import { fa } from '../i18n/fa';
import type { CharacterId } from '../theme/character';

const int = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : fallback);

/** Numbers on the mode card, read from the public settings (`GET /config`) with the shared defaults. */
export function arenaNumbers(raw: Record<string, unknown>): { entry: number; prize: number; maxMistakes: number } {
  const entry = int(raw['duel.entry_fee'], ENTRY_FEE_BASE);
  const houseCutPercent = Math.min(90, int(raw['duel.house_cut_percent'], HOUSE_CUT_PERCENT));
  // Only the two fields the payout reads; the rest of DuelRules is server-side.
  const prize = winnerPayout({ entryFee: entry, houseCutPercent, freePerDay: 0, freePayoutPercent: 0, consolation: 0, consolationCap: 0, rescueTarget: 0 });
  return { entry, prize, maxMistakes: Math.max(1, int(raw['game.match_max_mistakes'], MATCH_MAX_MISTAKES)) };
}

/** Market characters an opponent can appear as (the hero «dozari» is always the player). */
const RIVALS: readonly CharacterId[] = ['pahlevan', 'baqal', 'mashti', 'khale', 'mirza', 'goli'];

/** Stable character for an opponent, picked from their avatar key (or nickname). */
export function characterFor(key: string): CharacterId {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return RIVALS[h % RIVALS.length]!;
}

/** Groups one side found itself (revealed groups count for nobody). */
export const groupsBy = (view: MatchView, side: 0 | 1): number => view.solved.filter((g) => g.by === side).length;

/** Width of the player's (blue) half of the tug bar, in percent: 50 at a tie, 12.5 per group of lead. */
export const tugPercent = (mine: number, theirs: number): number => Math.min(100, Math.max(0, 50 + (mine - theirs) * 12.5));

/** «m:ss» of the turn clock. */
export const clockText = (sec: number): string => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** Cards in the player's own (locally shuffled) order; cards not in `order` keep their server order at the end. */
export function arrange<T extends { id: string }>(cards: readonly T[], order: readonly string[]): T[] {
  const at = new Map(order.map((id, i) => [id, i]));
  return cards.map((c, i) => ({ c, k: at.get(c.id) ?? order.length + i })).sort((x, y) => x.k - y.k).map((x) => x.c);
}

/** A fresh random order of the given ids (display only; the server never sees it). */
export function shuffled(ids: readonly string[], rand: () => number = Math.random): string[] {
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Why it ended, from the player's side: the server's reasons name the opponent, so a player who left sees their own line. */
export function endReason(outcome: 'won' | 'lost' | 'draw', reason: string): string {
  if (outcome === 'lost' && (reason === 'abandon' || reason === 'forfeit')) return fa.duel.arena.youLeft;
  return fa.duel.reasons[reason] ?? '';
}
