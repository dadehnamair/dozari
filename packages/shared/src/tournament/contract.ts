import { z } from 'zod';
import { TOURNAMENT_SIZES } from '../config/tournament.js';

export const TOURNAMENT_STATUSES = ['draft', 'open', 'running', 'finished', 'cancelled'] as const;
export const tournamentStatusSchema = z.enum(TOURNAMENT_STATUSES);

export const tournamentListItemSchema = z.object({
  id: z.string().uuid(),
  titleFa: z.string(),
  status: tournamentStatusSchema,
  size: z.number().int(),
  entryCoins: z.number().int().nonnegative(),
  minLevel: z.number().int().positive(),
  startsAt: z.number().int(),
  joined: z.number().int().nonnegative(),
  iconKey: z.string().nullable(),
  /** Is the caller entered. */
  entered: z.boolean(),
});
export type TournamentListItem = z.infer<typeof tournamentListItemSchema>;
export const tournamentListSchema = z.object({ tournaments: z.array(tournamentListItemSchema) });

export const bracketMatchSchema = z.object({
  round: z.number().int().positive(),
  slot: z.number().int().nonnegative(),
  a: z.object({ id: z.string().uuid(), nickname: z.string() }).nullable(),
  b: z.object({ id: z.string().uuid(), nickname: z.string() }).nullable(),
  winnerId: z.string().uuid().nullable(),
  status: z.enum(['waiting', 'ready', 'playing', 'done', 'bye']),
});

/** `GET /tournaments/:id`: the tournament's own page. */
export const tournamentDetailSchema = tournamentListItemSchema.extend({
  descriptionFa: z.string(),
  prizes: z.array(z.object({ place: z.number().int().positive(), coins: z.number().int().nonnegative(), spins: z.number().int().nonnegative().default(0) })),
  players: z.array(z.object({ id: z.string().uuid(), nickname: z.string(), avatarKey: z.string() })),
  bracket: z.array(bracketMatchSchema),
  rounds: z.number().int(),
  /** Why the caller cannot enter now, or null (they can, or they already did). */
  blocked: z.enum(['LEVEL', 'COINS', 'FULL', 'CLOSED', 'NOT_ACTIVATED', 'BUSY']).nullable(),
  /** Final places of a finished tournament. */
  results: z.array(z.object({ id: z.string().uuid(), nickname: z.string(), place: z.number().int().min(1).max(3), coins: z.number().int().nonnegative() })),
});
export type TournamentDetail = z.infer<typeof tournamentDetailSchema>;

export const tournamentSizeSchema = z.union(TOURNAMENT_SIZES.map((s) => z.literal(s)) as unknown as [z.ZodLiteral<4>, z.ZodLiteral<8>, ...z.ZodLiteral<number>[]]);

export const TOURNAMENT_ERRORS = ['NOT_FOUND', 'CLOSED', 'FULL', 'ALREADY_IN', 'NOT_IN', 'LEVEL', 'COINS', 'NOT_ACTIVATED', 'BUSY', 'BAD_STATE', 'TOO_FEW'] as const;
export type TournamentError = (typeof TOURNAMENT_ERRORS)[number];
