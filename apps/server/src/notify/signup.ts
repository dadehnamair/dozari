import { eq, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import { randomGuestIdentity } from '@dozari/shared';
import type { Rng } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';

/**
 * Account for a number the Bale bot has just verified (the sender shared their own contact): the player holding the number, or a new
 * one with the number already verified and no device yet. The app reaches it later through phone login.
 */
export function createBaleSignup(db: Db, onCreated: (userId: string) => Promise<void>, rng: Rng = Math.random) {
  const holder = async (phone: string): Promise<string | null> => (await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1))[0]?.id ?? null;
  return async (phone: string): Promise<{ userId: string; created: boolean }> => {
    const existing = await holder(phone);
    if (existing) return { userId: existing, created: false };
    const id = uuidv7();
    const identity = randomGuestIdentity(rng);
    try {
      await db.insert(users).values({ id, nickname: identity.nickname, avatarKey: identity.avatarKey, phone, phoneVerifiedAt: new Date() });
    } catch (err) {
      // Lost a race on the unique phone index: the winner's account is the one.
      const winner = await holder(phone);
      if (winner) return { userId: winner, created: false };
      throw err;
    }
    await onCreated(id).catch((err: unknown) => console.warn('[bale] onCreated failed', err));
    return { userId: id, created: true };
  };
}
