import { eq, sql, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';
import type { UserRecord, UserRepository } from './service.js';

const columns = { id: users.id, nickname: users.nickname, avatarKey: users.avatarKey, isBanned: users.isBanned, sessionsValidAfter: users.sessionsValidAfter };

export function createDbUserRepository(db: Db): UserRepository {
  const one = async (where: ReturnType<typeof eq>): Promise<UserRecord | null> => {
    const [row] = await db.select(columns).from(users).where(where).limit(1);
    return row ? { ...row, sessionsValidAfter: row.sessionsValidAfter?.getTime() ?? null } : null;
  };
  return {
    findByDeviceId: (deviceId) => one(eq(users.deviceId, deviceId)),
    findById: (id) => one(eq(users.id, id)),
    async createGuest(deviceId, identity) {
      // Two first requests from one device race on the unique key: the loser's insert is a no-op and both read the winner's row.
      await db
        .insert(users)
        .values({ id: uuidv7(), deviceId, nickname: identity.nickname, avatarKey: identity.avatarKey })
        .onDuplicateKeyUpdate({ set: { deviceId: sql`${users.deviceId}` } });
      const row = await one(eq(users.deviceId, deviceId));
      if (!row) throw new Error('guest account missing right after insert');
      return row;
    },
    async anonymize(id) {
      const now = new Date();
      await db
        .update(users)
        .set({ deviceId: null, nickname: 'حساب حذف‌شده', phone: null, phonePending: null, phoneVerifiedAt: null, email: null, handle: null, equippedBadgeId: null, isBanned: true, banReason: 'account_deleted', bannedAt: now, sessionsValidAfter: now })
        .where(eq(users.id, id));
    },
    async claimDevice(id, deviceId) {
      await db.transaction(async (tx) => {
        await tx.update(users).set({ deviceId: null }).where(eq(users.deviceId, deviceId));
        await tx.update(users).set({ deviceId }).where(eq(users.id, id));
      });
    },
    async signOutEverywhere(id) {
      await db.update(users).set({ sessionsValidAfter: new Date() }).where(eq(users.id, id));
    },
    async touch(id) {
      await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, id));
    },
  };
}
