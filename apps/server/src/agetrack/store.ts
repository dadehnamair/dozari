import { eq, inArray, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import type { AgeTrackStore } from './service.js';

/** Persistence of the chosen age track (columns on `users`). */
export function createDbAgeTrackStore(db: Db): AgeTrackStore {
  return {
    async get(userId) {
      const [u] = await db.select({ track: users.ageTrack, setAt: users.ageTrackSetAt }).from(users).where(eq(users.id, userId));
      return { track: u?.track ?? 'adult', setAt: u?.setAt ?? null };
    },
    async getMany(ids) {
      const out = new Map<string, 'kid' | 'teen' | 'adult'>();
      if (ids.length === 0) return out;
      const rows = await db.select({ id: users.id, track: users.ageTrack }).from(users).where(inArray(users.id, [...ids]));
      for (const r of rows) out.set(r.id, r.track);
      return out;
    },
    async save(userId, track, at) {
      await db.update(users).set({ ageTrack: track, ageTrackSetAt: at }).where(eq(users.id, userId));
    },
  };
}
