/** Smallest power of two ≥ n (min 2): the bracket size that fits `n` players with byes. */
export function bracketSize(n: number): number {
  let s = 2;
  while (s < n) s *= 2;
  return s;
}

export const roundCount = (size: number): number => Math.log2(size);

export interface Slot {
  round: number;
  slot: number;
  /** Player ids; null = empty (a bye, or still waiting for an earlier round). */
  a: string | null;
  b: string | null;
}

/** Standard seeding order for a bracket of `size`: 1 v size, 2 v size-1 … arranged so the top seeds meet last. */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const next: number[] = [];
    const total = order.length * 2 + 1;
    for (const s of order) next.push(s, total - s);
    order = next;
  }
  return order;
}

/**
 * Round 1 of a bracket for `players` (best seed first). Missing players are byes and sit against the best seeds, so a bye is never a
 * lone bottom seed. Later rounds are created empty (round 2 … final).
 */
export function buildBracket(players: readonly string[], size: number): Slot[] {
  const order = seedOrder(size);
  const seatOf = (seed: number): string | null => players[seed - 1] ?? null;
  const slots: Slot[] = [];
  for (let i = 0; i < size / 2; i++) slots.push({ round: 1, slot: i, a: seatOf(order[i * 2]!), b: seatOf(order[i * 2 + 1]!) });
  for (let r = 2, n = size / 4; n >= 1; r++, n /= 2) for (let i = 0; i < n; i++) slots.push({ round: r, slot: i, a: null, b: null });
  return slots;
}

/** Where the winner of (round, slot) plays next, or null for the final. */
export function nextSlot(round: number, slot: number, size: number): { round: number; slot: number; side: 'a' | 'b' } | null {
  if (round >= roundCount(size)) return null;
  return { round: round + 1, slot: Math.floor(slot / 2), side: slot % 2 === 0 ? 'a' : 'b' };
}

export type RoundName = 'final' | 'semi' | 'quarter' | 'round';

/** Round label from the end: the last round is the final, then semi-finals, quarter-finals, then "round N". */
export function roundName(round: number, size: number): { name: RoundName; n: number } {
  const fromEnd = roundCount(size) - round;
  return fromEnd === 0 ? { name: 'final', n: round } : fromEnd === 1 ? { name: 'semi', n: round } : fromEnd === 2 ? { name: 'quarter', n: round } : { name: 'round', n: round };
}

export interface PlaceResult {
  userId: string;
  /** 1 = winner, 2 = finalist, 3 = lost a semi-final (both semi-final losers share place 3), 0 = lost earlier. */
  place: 0 | 1 | 2 | 3;
}

/** Final places from the played slots: only the top three levels matter for prizes. */
export function finalPlaces(matches: readonly { round: number; a: string | null; b: string | null; winner: string | null }[], size: number): PlaceResult[] {
  const last = roundCount(size);
  const out: PlaceResult[] = [];
  const loser = (m: { a: string | null; b: string | null; winner: string | null }) => (m.winner === null ? null : m.winner === m.a ? m.b : m.a);
  for (const m of matches) {
    if (m.round === last && m.winner) {
      out.push({ userId: m.winner, place: 1 });
      const l = loser(m);
      if (l) out.push({ userId: l, place: 2 });
    } else if (last >= 2 && m.round === last - 1 && m.winner) {
      const l = loser(m);
      if (l) out.push({ userId: l, place: 3 });
    }
  }
  return out;
}
