import { z } from 'zod';
import { ageTrackSchema } from './contract.js';

/** Config of the guardian link (docs/logic/age-tracks.md §First-run flow). Proposed defaults. */
export const GUARDIAN_LINK_CODE_LENGTH = 6;
export const GUARDIAN_LINK_CODE_TTL_SEC = 10 * 60;
/** A guardian can hold this many child profiles. */
export const GUARDIAN_MAX_CHILDREN = 6;

/** Tracks a child profile can have (a child is never an adult). */
export const childTrackSchema = z.enum(['kid', 'teen']);

export const guardianRequestSchema = z.object({ phone: z.string().min(5).max(20) });
export const guardianConfirmSchema = z.object({ phone: z.string().min(5).max(20), code: z.string().min(3).max(10) });
export const childCreateSchema = z.object({ track: childTrackSchema });
export const childTrackPutSchema = z.object({ track: childTrackSchema });
export const childLinkRequestSchema = z.object({ code: z.string().regex(/^\d{6}$/), deviceId: z.string().min(8).max(64) });

export const childRowSchema = z.object({ id: z.string(), nickname: z.string(), avatarKey: z.string(), track: ageTrackSchema });
export type ChildRow = z.infer<typeof childRowSchema>;
export const childrenResponseSchema = z.object({ children: z.array(childRowSchema), phoneVerified: z.boolean(), max: z.number() });
export type ChildrenResponse = z.infer<typeof childrenResponseSchema>;

export const myGuardianSchema = z.object({ linked: z.boolean() });
export const linkCodeResponseSchema = z.object({ code: z.string(), expiresInSec: z.number() });
