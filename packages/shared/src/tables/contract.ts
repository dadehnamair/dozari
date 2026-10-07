import { z } from 'zod';
import { TABLE_ENTRY_MAX, TABLE_PRICE_ROUNDS_MAX, TABLE_ROUNDS_MAX, TABLE_ROUNDS_MIN } from '../config/tables.js';
import { matchPlayerProfileSchema, matchViewSchema } from '../socket/events.js';
import { TABLE_FORMATS, TABLE_ICONS, TABLE_NAME_MAX } from './code.js';

export const TABLE_ERRORS = ['NOT_FOUND', 'FULL', 'LOCKED', 'EXPIRED', 'NOT_HOST', 'NOT_IN', 'NOT_READY', 'NEED_PLAYERS', 'BUSY', 'IN_MATCH', 'START_FAILED', 'INVALID', 'NOT_TEAM', 'NEEDS_GUARDIAN', 'FEATURE_OFF', 'NO_COINS', 'LOW_ENTRY', 'TOO_MANY', 'NOT_REQUESTED', 'ALREADY_IN'] as const;
export type TableError = (typeof TABLE_ERRORS)[number];

export const createTableBodySchema = z.object({
  name: z.string().trim().min(1).max(TABLE_NAME_MAX),
  icon: z.enum(TABLE_ICONS),
  /** Every guest must press "ready" before the host can start. */
  requireReady: z.boolean().default(false),
  /** 1v1 (two seats) or 2v2 (four seats, two per side). */
  format: z.enum(TABLE_FORMATS).default('1v1'),
  /** A family table: only a guardian and their own children sit there, across tracks (docs/logic/age-tracks.md §Friends, duels and chat). */
  family: z.boolean().default(false),
  /** Boards played («دور»): the more rounds, the higher the minimum entry. */
  rounds: z.number().int().min(TABLE_ROUNDS_MIN).max(TABLE_ROUNDS_MAX).default(TABLE_ROUNDS_MIN),
  /** Coins each player puts in; absent = the minimum for the rounds. The server refuses less than that (0 only where coins do not move). */
  entryFee: z.number().int().min(0).max(TABLE_ENTRY_MAX).optional(),
  /** Price-guess questions («سوال قیمتی») asked after the boards: 0 = none; only a 1v1 table has them. Absent = all of them. */
  priceRounds: z.number().int().min(0).max(TABLE_PRICE_ROUNDS_MAX).optional(),
  /** Hidden from the open-tables list: only people with the code (or an invite) come in. Tables are public by default. */
  isPrivate: z.boolean().default(false),
});
export type CreateTableBody = z.infer<typeof createTableBodySchema>;

export const tableViewSchema = z.object({
  code: z.string(),
  name: z.string(),
  icon: z.string(),
  format: z.enum(TABLE_FORMATS).default('1v1'),
  family: z.boolean().default(false),
  requireReady: z.boolean(),
  locked: z.boolean(),
  hostId: z.string().uuid(),
  /** The caller's own state, so the screen knows which buttons to show. */
  youAreHost: z.boolean(),
  youAreIn: z.boolean(),
  expiresAt: z.number(),
  /** True while the table's players are in a live match (the table stays for a rematch). */
  inMatch: z.boolean(),
  players: z.array(z.object({ id: z.string().uuid(), nickname: z.string(), avatarKey: z.string(), ready: z.boolean(), isHost: z.boolean(), /** The row of the caller. */ isYou: z.boolean().default(false), /** Team of a 2v2 table (0 or 1); a 1v1 table has host 0, guest 1. */ side: z.union([z.literal(0), z.literal(1)]).default(0) })),
  seats: z.number().int(),
  rounds: z.number().int().default(1),
  /** Price-guess questions after the boards (0 = none). */
  priceRounds: z.number().int().default(0),
  entryFee: z.number().int().default(0),
  isPrivate: z.boolean().default(false),
  /** Host only: people asking to sit down, oldest first. */
  requests: z.array(z.object({ id: z.string().uuid(), nickname: z.string(), avatarKey: z.string() })).default([]),
});
export type TableView = z.infer<typeof tableViewSchema>;

/** One row of the open-tables list. */
export const publicTableSchema = z.object({
  code: z.string(),
  name: z.string(),
  icon: z.string(),
  format: z.enum(TABLE_FORMATS),
  rounds: z.number().int(),
  priceRounds: z.number().int().default(0),
  entryFee: z.number().int(),
  seats: z.number().int(),
  taken: z.number().int(),
  hostNickname: z.string(),
  hostAvatarKey: z.string(),
  /** The caller's own request at this table: none, waiting for the host, or turned down. */
  yourRequest: z.enum(['none', 'pending', 'denied']),
  /** People watching the match of a playing table right now. */
  watchers: z.number().int().default(0),
  /** `open` takes requests; every other status is view only: full, a match in play, locked, or closed a short while ago. */
  status: z.enum(['open', 'full', 'playing', 'locked', 'closed']),
});
export type PublicTable = z.infer<typeof publicTableSchema>;
export const publicTablesSchema = z.object({ tables: z.array(publicTableSchema) });

/** A playing table seen from the stands (read only): the board as seat 0 sees it minus anything private, who plays, card names, and how many watch. */
export const tableWatchSchema = z.object({
  name: z.string(),
  icon: z.string(),
  format: z.enum(TABLE_FORMATS),
  view: matchViewSchema,
  players: z.array(matchPlayerProfileSchema),
  /** Product id → name, for the solved rows (their cards have left the board). */
  names: z.record(z.string(), z.string()),
  /** The board is over and the price-guess questions are being asked. */
  inPriceRound: z.boolean(),
  watchers: z.number().int(),
});
export type TableWatch = z.infer<typeof tableWatchSchema>;
