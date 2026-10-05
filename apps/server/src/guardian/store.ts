import { and, eq, gt, guardianLinkCodes, guardianLinks, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import { randomGuestIdentity } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';
import type { GuardianStore } from './service.js';

const isDup = (err: unknown): boolean => {
  const e = err as { code?: string; errno?: number; cause?: unknown } | null;
  return Boolean(e && (e.code === 'ER_DUP_ENTRY' || e.errno === 1062 || isDup(e.cause)));
};

/** Persistence of guardian links and link codes. */
export function createDbGuardianStore(db: Db, rng: () => number = Math.random): GuardianStore {
  return {
    async guardianOf(childId) {
      const [r] = await db.select({ g: guardianLinks.guardianId }).from(guardianLinks).where(eq(guardianLinks.childId, childId));
      return r?.g ?? null;
    },
    async childrenOf(guardianId) {
      const rows = await db
        .select({ id: users.id, nickname: users.nickname, avatarKey: users.avatarKey, track: users.ageTrack })
        .from(guardianLinks)
        .innerJoin(users, eq(users.id, guardianLinks.childId))
        .where(eq(guardianLinks.guardianId, guardianId))
        .orderBy(guardianLinks.createdAt);
      return rows;
    },
    async link(guardianId, childId) {
      try {
        await db.insert(guardianLinks).values({ childId, guardianId });
        return true;
      } catch (err) {
        if (isDup(err)) return false;
        throw err;
      }
    },
    async unlink(guardianId, childId) {
      const [res] = await db.delete(guardianLinks).where(and(eq(guardianLinks.childId, childId), eq(guardianLinks.guardianId, guardianId)));
      await db.delete(guardianLinkCodes).where(eq(guardianLinkCodes.childId, childId));
      return res.affectedRows > 0;
    },
    async isChildOf(guardianId, childId) {
      const [r] = await db.select({ c: guardianLinks.childId }).from(guardianLinks).where(and(eq(guardianLinks.childId, childId), eq(guardianLinks.guardianId, guardianId)));
      return !!r;
    },
    async createChild(guardianId, track) {
      const identity = randomGuestIdentity(rng);
      const id = uuidv7();
      await db.transaction(async (tx) => {
        // No device and no phone: the child's own device gets in with a link code, which claims the device.
        await tx.insert(users).values({ id, deviceId: `child:${id}`.slice(0, 64), nickname: identity.nickname, avatarKey: identity.avatarKey, ageTrack: track, ageTrackSetAt: new Date() });
        await tx.insert(guardianLinks).values({ childId: id, guardianId });
      });
      return id;
    },
    async putCode(code, childId, guardianId, expiresAt) {
      await db.delete(guardianLinkCodes).where(eq(guardianLinkCodes.childId, childId));
      try {
        await db.insert(guardianLinkCodes).values({ code, childId, guardianId, expiresAt: new Date(expiresAt) });
        return true;
      } catch (err) {
        if (isDup(err)) return false;
        throw err;
      }
    },
    async takeCode(code, now) {
      const [r] = await db.select().from(guardianLinkCodes).where(and(eq(guardianLinkCodes.code, code), gt(guardianLinkCodes.expiresAt, new Date(now))));
      if (!r) return null;
      // Delete is the lock: of two racing redeems only one sees a row removed.
      const [res] = await db.delete(guardianLinkCodes).where(eq(guardianLinkCodes.code, code));
      return res.affectedRows > 0 ? { childId: r.childId, guardianId: r.guardianId } : null;
    },
  };
}
