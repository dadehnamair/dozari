import { ApiError } from '../net/http';

/** The server answers 403 `needs_guardian` (friends) or `NEEDS_GUARDIAN` (tables) to a kid/teen with no linked guardian. */
export function needsGuardian(e: unknown): boolean {
  return e instanceof ApiError && e.status === 403 && (e.code === 'needs_guardian' || e.code === 'NEEDS_GUARDIAN');
}
