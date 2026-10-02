import { z } from 'zod';
import { DEVICE_ID_PATTERN } from '../identity/index.js';
import { soloCardSchema } from '../solo/contract.js';

/**
 * Socket.io contract between client and server (docs/logic/matchmaking.md §Socket events). Events are named
 * `domain:action`. Every client command is answered with an ack; the server pushes full redacted snapshots
 * (`match:state`) plus `match:event` for animations. Auth: JWT in the handshake `auth.token`.
 * The 1v1 and 2v2 queues and the match flow (with teammate proposals) exist so far; rooms, parties and chat get their events with their phases.
 */

export const ClientEvent = {
  queueJoin: 'queue:join',
  queueLeave: 'queue:leave',
  matchReady: 'match:ready',
  matchSubmit: 'match:submit',
  matchPropose: 'match:propose',
  matchResume: 'match:resume',
  matchLeave: 'match:leave',
  chatJoin: 'chat:join',
  chatTaunt: 'chat:taunt',
} as const;

export const ServerEvent = {
  queueStatus: 'queue:status',
  matchFound: 'match:found',
  matchState: 'match:state',
  matchEvent: 'match:event',
  matchEnded: 'match:ended',
  chatMessage: 'chat:message',
  error: 'error',
} as const;

export type ClientEventName = (typeof ClientEvent)[keyof typeof ClientEvent];
export type ServerEventName = (typeof ServerEvent)[keyof typeof ServerEvent];

/** Localised on the client in `fa.ts`; never free text from the server. */
export const ERROR_CODES = [
  'UNAUTHORIZED',
  'INVALID_PAYLOAD',
  'RATE_LIMITED',
  'ALREADY_QUEUED',
  'NOT_QUEUED',
  'ALREADY_IN_MATCH',
  'NOT_IN_MATCH',
  'UNKNOWN_MATCH',
  'NOT_YOUR_TURN',
  'NOT_CAPTAIN',
  'NOT_TEAM_MATCH',
  'INVALID_SELECTION',
  'DUPLICATE_SELECTION',
  'MATCH_FINISHED',
  'INSUFFICIENT_COINS',
  'MAINTENANCE',
  'FEATURE_OFF',
  'DAILY_CAP',
  'NO_CITY',
  'MUTED',
  'UNKNOWN_TAUNT',
  'INTERNAL',
] as const;
export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

const side = z.union([z.literal(0), z.literal(1)]);
const level = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

/** Ack of a command: `{ok:true, ...}` or `{ok:false, error}`. */
export const ackSchema = z.discriminatedUnion('ok', [z.object({ ok: z.literal(true) }), z.object({ ok: z.literal(false), error: errorCodeSchema })]);
export type Ack = z.infer<typeof ackSchema>;

// ---- client -> server payloads -------------------------------------------------------------------------------

export const queueJoinSchema = z.object({ mode: z.enum(['duel', 'team']) });
/** A teammate's in-progress selection (0-4 cards) shown to the captain; never stored, only the latest counts. */
export const matchProposeSchema = z.object({ itemIds: z.array(z.string().min(1).max(64)).max(4) });
export const matchSubmitSchema = z.object({ itemIds: z.array(z.string().min(1).max(64)).length(4) });
/** Without a match id the server resumes whatever match the player is in (e.g. one a private table started). */
export const matchResumeSchema = z.object({ matchId: z.string().uuid().optional() });

export type QueueJoin = z.infer<typeof queueJoinSchema>;
export type MatchPropose = z.infer<typeof matchProposeSchema>;
export type MatchSubmit = z.infer<typeof matchSubmitSchema>;
export type MatchResume = z.infer<typeof matchResumeSchema>;

// ---- server -> client payloads -------------------------------------------------------------------------------

/** Public profile of a participant. Whether a seat is a bot is never part of any payload. */
export const matchPlayerProfileSchema = z.object({
  /** Lets a team tell who the captain is; the profile of an opponent carries it too (it is public elsewhere). */
  userId: z.string().optional(),
  side,
  nickname: z.string(),
  avatarKey: z.string(),
  level: z.number().int().positive(),
  coins: z.number().int().nonnegative(),
});

export const queueStatusSchema = z.object({ waitedSec: z.number().int().nonnegative(), position: z.number().int().positive().optional() });

export const matchFoundSchema = z.object({
  matchId: z.string().uuid(),
  you: side,
  /** 2 players (1v1) or 4 (2v2, listed side 0 first). */
  players: z.array(matchPlayerProfileSchema).min(2).max(4),
});

export const matchSolvedGroupSchema = z.object({
  level,
  titleFa: z.string(),
  explanationFa: z.string(),
  productIds: z.array(z.string()),
  /** Side that found it; null when the game revealed it. */
  by: side.nullable(),
});

export const matchResultSchema = z.object({
  winner: side.nullable(),
  reason: z.enum(['solved', 'locked_out', 'forfeit', 'abandon']),
});

/** Full redacted snapshot, sent on every change. Unsolved groups cannot be represented here (rule 4). */
export const matchViewSchema = z.object({
  matchId: z.string().uuid(),
  you: side,
  /** The viewer's own user id, to compare with `captain`. */
  youId: z.string().optional(),
  /** True in a 2v2 (two players per side). */
  team: z.boolean().optional(),
  /** Board in play (0-based) of `rounds` boards: a 2v2 plays several 16-card packs, scores adding up. */
  round: z.number().int().nonnegative().optional(),
  rounds: z.number().int().positive().optional(),
  cards: z.array(soloCardSchema),
  solved: z.array(matchSolvedGroupSchema),
  scores: z.tuple([z.number().int(), z.number().int()]),
  mistakes: z.tuple([z.number().int(), z.number().int()]),
  lockedOut: z.tuple([z.boolean(), z.boolean()]),
  turn: side,
  /** Who submits for each side right now (2v2 rotates it every turn). Optional for older snapshots. */
  captain: z.tuple([z.string(), z.string()]).optional(),
  /** The viewer's own team's latest proposal (2v2 only): the teammate's highlighted cards. Opponents never get it. */
  proposal: z.object({ by: z.string(), itemIds: z.array(z.string()) }).nullable().optional(),
  turnId: z.number().int().positive(),
  /** Absolute epoch ms when the active turn times out. */
  turnEndsAt: z.number().int(),
  status: z.enum(['playing', 'finished']),
  result: matchResultSchema.nullable(),
});

/** Animation hints; both sides see every submitted selection and its result. */
export const matchEventSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('guess'), side, itemIds: z.array(z.string()).length(4), outcome: z.enum(['correct', 'one_away', 'wrong']) }),
  z.object({ t: z.literal('group_solved'), side, level, points: z.number().int().positive(), firstBlood: z.boolean() }),
  z.object({ t: z.literal('group_revealed'), level }),
  /** A board is over (multi-board match): its full solution may be shown, then the next board starts. */
  z.object({ t: z.literal('board_done'), round: z.number().int().nonnegative(), groups: z.array(z.object({ level, titleFa: z.string(), explanationFa: z.string(), productIds: z.array(z.string()) })).length(4).optional() }),
  z.object({ t: z.literal('board'), round: z.number().int().nonnegative(), rounds: z.number().int().positive() }),
  z.object({ t: z.literal('locked_out'), side }),
  z.object({ t: z.literal('timeout'), side }),
  z.object({ t: z.literal('turn'), side, turnId: z.number().int().positive(), captain: z.string().optional() }),
  z.object({ t: z.literal('captain'), side, userId: z.string() }),
  z.object({ t: z.literal('finished'), result: matchResultSchema }),
]);

export const matchEndedSchema = z.object({
  matchId: z.string().uuid(),
  result: matchResultSchema,
  /** Final tallies including the price-guess round. */
  scores: z.tuple([z.number().int(), z.number().int()]),
  /** Full solution, sent only now that the match is over. */
  groups: z.array(z.object({ level, titleFa: z.string(), explanationFa: z.string(), productIds: z.array(z.string()) })).length(4),
});

export const errorEventSchema = z.object({ error: errorCodeSchema });

export type MatchPlayerProfile = z.infer<typeof matchPlayerProfileSchema>;
export type QueueStatus = z.infer<typeof queueStatusSchema>;
export type MatchFound = z.infer<typeof matchFoundSchema>;
export type MatchView = z.infer<typeof matchViewSchema>;
export type MatchEventPayload = z.infer<typeof matchEventSchema>;
export type MatchEnded = z.infer<typeof matchEndedSchema>;

/** REST side of auth (`POST /auth/guest`). */
export const guestLoginSchema = z.object({ deviceId: z.string().regex(DEVICE_ID_PATTERN) });
export const sessionSchema = z.object({
  token: z.string(),
  user: z.object({ id: z.string().uuid(), nickname: z.string(), avatarKey: z.string() }),
});
export type GuestLogin = z.infer<typeof guestLoginSchema>;
export type Session = z.infer<typeof sessionSchema>;
