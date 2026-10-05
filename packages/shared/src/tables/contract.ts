import { z } from 'zod';
import { TABLE_FORMATS, TABLE_ICONS, TABLE_NAME_MAX } from './code.js';

export const TABLE_ERRORS = ['NOT_FOUND', 'FULL', 'LOCKED', 'EXPIRED', 'NOT_HOST', 'NOT_IN', 'NOT_READY', 'NEED_PLAYERS', 'BUSY', 'IN_MATCH', 'START_FAILED', 'INVALID', 'NOT_TEAM', 'NEEDS_GUARDIAN', 'FEATURE_OFF'] as const;
export type TableError = (typeof TABLE_ERRORS)[number];

export const createTableBodySchema = z.object({
  name: z.string().trim().min(1).max(TABLE_NAME_MAX),
  icon: z.enum(TABLE_ICONS),
  /** Every guest must press "ready" before the host can start. */
  requireReady: z.boolean().default(false),
  /** 1v1 (two seats) or 2v2 (four seats, two per side). */
  format: z.enum(TABLE_FORMATS).default('1v1'),
});
export type CreateTableBody = z.infer<typeof createTableBodySchema>;

export const tableViewSchema = z.object({
  code: z.string(),
  name: z.string(),
  icon: z.string(),
  format: z.enum(TABLE_FORMATS).default('1v1'),
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
});
export type TableView = z.infer<typeof tableViewSchema>;
