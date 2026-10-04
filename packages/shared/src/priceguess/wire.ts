import { z } from 'zod';
import type { PriceGuessState, Side } from './competitive.js';

/** One price-guess round of a duel as a viewer sees it. Rials travel as decimal strings (BigInt is not JSON). */
export const priceRoundCurrentSchema = z.object({
  productId: z.string(),
  year: z.number().int(),
  nameFa: z.string(),
  unitFa: z.string().nullable(),
  iconKey: z.string().nullable(),
});

export const priceRoundRevealedSchema = z.object({
  index: z.number().int().nonnegative(),
  productId: z.string(),
  nameFa: z.string(),
  year: z.number().int(),
  actualRials: z.string(),
  /** null = did not guess in time. */
  yourGuess: z.string().nullable(),
  opponentGuess: z.string().nullable(),
  winner: z.enum(['you', 'opponent', 'draw']),
});

/** The duel's price-guess phase (docs/logic/price-guess-round.md §Competitive scoring). Never carries the real price or the opponent's hidden guess before the reveal. */
export const priceRoundViewSchema = z.object({
  roundIndex: z.number().int().nonnegative(),
  totalRounds: z.number().int().positive(),
  current: priceRoundCurrentSchema.nullable(),
  youSubmitted: z.boolean(),
  /** A fact (the opponent locked in), not the number. */
  opponentSubmitted: z.boolean(),
  /** Absolute epoch ms when the round is revealed whether or not everybody guessed. */
  endsAt: z.number().int(),
  revealed: z.array(priceRoundRevealedSchema),
  /** Coins each side has on every round (absent = no wager), and whether the viewer put theirs down this round (false = could not afford it and sits the round out). */
  wager: z.number().int().positive().optional(),
  youIn: z.boolean().optional(),
});
export type PriceRoundView = z.infer<typeof priceRoundViewSchema>;

export interface PriceRoundItem {
  nameFa: string;
  unitFa: string | null;
  iconKey: string | null;
}

/** Wire form of the state for one side. Pure; the caller supplies item texts and the round deadline. */
export function toPriceRoundView(state: PriceGuessState, viewer: Side, itemOf: (productId: string) => PriceRoundItem, endsAt: number): PriceRoundView {
  const other: Side = viewer === 'a' ? 'b' : 'a';
  const round = state.rounds[state.index];
  const str = (v: bigint | null) => (v === null ? null : v.toString());
  return {
    roundIndex: Math.min(state.index, state.rounds.length - 1),
    totalRounds: state.rounds.length,
    current: state.status === 'playing' && round ? { productId: round.productId, year: round.year, ...itemOf(round.productId) } : null,
    youSubmitted: state.submitted[viewer],
    opponentSubmitted: state.submitted[other],
    endsAt,
    revealed: state.revealed.map((r) => ({
      index: r.index,
      productId: r.productId,
      nameFa: itemOf(r.productId).nameFa,
      year: r.year,
      actualRials: r.actualRials.toString(),
      yourGuess: str(r.guesses[viewer]),
      opponentGuess: str(r.guesses[other]),
      winner: r.winner === 'draw' ? 'draw' : r.winner === viewer ? 'you' : 'opponent',
    })),
  };
}
