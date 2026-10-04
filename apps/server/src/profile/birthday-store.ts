import { and, birthdayClaims, birthdayNotices, eq, inArray, isNotNull, or, userBalances, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import type { BirthDate } from '@dozari/shared';
import { applyGemEntry } from '../economy/gems.js';
import { applyLedgerEntry } from '../economy/ledger.js';
import type { BirthRecord, BirthdayStore } from './birthday.js';

const asBirth = (r: { y: number | null; m: number | null; d: number | null }): BirthDate | null => (r.y && r.m && r.d ? { year: r.y, month: r.m, day: r.d } : null);

/** Persistence of birth dates (columns on `users`), the yearly gift lock and the friend-message log. */
export function createDbBirthdayStore(db: Db): BirthdayStore {
  return {
    async get(userId) {
      const [u] = await db.select({ y: users.birthYear, m: users.birthMonth, d: users.birthDay, showAge: users.showAge, notify: users.notifyBirthday }).from(users).where(eq(users.id, userId));
      return { birth: u ? asBirth(u) : null, showAge: u?.showAge ?? false, notifyFriends: u?.notify ?? true };
    },
    async getMany(ids) {
      const out = new Map<string, { birth: BirthDate; showAge: boolean }>();
      if (ids.length === 0) return out;
      const rows = await db.select({ id: users.id, y: users.birthYear, m: users.birthMonth, d: users.birthDay, showAge: users.showAge }).from(users).where(and(inArray(users.id, [...ids]), isNotNull(users.birthYear)));
      for (const r of rows) {
        const birth = asBirth(r);
        if (birth) out.set(r.id, { birth, showAge: r.showAge });
      }
      return out;
    },
    async save(userId, rec: BirthRecord) {
      await db.update(users).set({ birthYear: rec.birth?.year ?? null, birthMonth: rec.birth?.month ?? null, birthDay: rec.birth?.day ?? null, showAge: rec.showAge, notifyBirthday: rec.notifyFriends }).where(eq(users.id, userId));
    },
    async claimed(userId, year) {
      const [r] = await db.select({ y: birthdayClaims.year }).from(birthdayClaims).where(and(eq(birthdayClaims.userId, userId), eq(birthdayClaims.year, year)));
      return !!r;
    },
    claim: (userId, year, gift) =>
      db.transaction(async (tx) => {
        // The claim row is the lock: a second tap inserts nothing and pays nothing.
        const [res] = await tx.insert(birthdayClaims).ignore().values({ userId, year });
        if (res.affectedRows < 1) return null;
        if (gift.coins > 0) await applyLedgerEntry(tx, { userId, delta: gift.coins, reason: 'birthday_gift', refType: 'birthday', refId: String(year), idempotencyKey: `birthday_gift:${userId}:${year}` });
        if (gift.gems > 0) await applyGemEntry(tx, { userId, delta: gift.gems, reason: 'birthday_gift', refType: 'birthday', refId: String(year), idempotencyKey: `birthday_gift:${userId}:${year}` });
        const [b] = await tx.select({ b: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, userId));
        return { balance: b?.b ?? 0 };
      }),
    async dueOn(pairs) {
      if (pairs.length === 0) return [];
      const rows = await db
        .select({ id: users.id, nickname: users.nickname, y: users.birthYear, m: users.birthMonth, d: users.birthDay })
        .from(users)
        .where(and(eq(users.notifyBirthday, true), isNotNull(users.birthYear), or(...pairs.map(([m, d]) => and(eq(users.birthMonth, m), eq(users.birthDay, d))))));
      return rows.flatMap((r) => {
        const birth = asBirth(r);
        return birth ? [{ id: r.id, nickname: r.nickname, birth }] : [];
      });
    },
    async notice(userId, year, stage) {
      const [res] = await db.insert(birthdayNotices).ignore().values({ userId, year, stage });
      return res.affectedRows > 0;
    },
  };
}

/** In-memory twin for tests. */
export function createMemoryBirthdayStore(): BirthdayStore & { users: Map<string, BirthRecord & { nickname: string }>; coins: Map<string, number>; gems: Map<string, number> } {
  const people = new Map<string, BirthRecord & { nickname: string }>();
  const claims = new Set<string>();
  const notices = new Set<string>();
  const coins = new Map<string, number>();
  const gems = new Map<string, number>();
  const rec = (id: string): BirthRecord & { nickname: string } => people.get(id) ?? { birth: null, showAge: false, notifyFriends: true, nickname: id };
  return {
    users: people,
    coins,
    gems,
    async get(id) {
      const r = rec(id);
      return { birth: r.birth, showAge: r.showAge, notifyFriends: r.notifyFriends };
    },
    async getMany(ids) {
      const out = new Map<string, { birth: BirthDate; showAge: boolean }>();
      for (const id of ids) {
        const r = people.get(id);
        if (r?.birth) out.set(id, { birth: r.birth, showAge: r.showAge });
      }
      return out;
    },
    async save(id, r) {
      people.set(id, { ...rec(id), ...r });
    },
    async claimed(id, year) {
      return claims.has(`${id}:${year}`);
    },
    async claim(id, year, gift) {
      if (claims.has(`${id}:${year}`)) return null;
      claims.add(`${id}:${year}`);
      coins.set(id, (coins.get(id) ?? 0) + gift.coins);
      gems.set(id, (gems.get(id) ?? 0) + gift.gems);
      return { balance: coins.get(id) ?? 0 };
    },
    async dueOn(pairs) {
      return [...people.entries()].flatMap(([id, r]) => (r.birth && r.notifyFriends && pairs.some(([m, d]) => r.birth!.month === m && r.birth!.day === d) ? [{ id, nickname: r.nickname, birth: r.birth }] : []));
    },
    async notice(id, year, stage) {
      const key = `${id}:${year}:${stage}`;
      if (notices.has(key)) return false;
      notices.add(key);
      return true;
    },
  };
}
