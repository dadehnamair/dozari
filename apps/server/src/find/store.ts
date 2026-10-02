import { and, eq, inArray, users } from '@dozari/db';
import type { Db } from '@dozari/db';

/** I/O boundary of finding players: public IDs, phone lookup, the phone-findability switch. */
export interface FindStore {
  handleOf(userId: string): Promise<string | null>;
  /** False when the ID is already taken. */
  assignHandle(userId: string, handle: string): Promise<boolean>;
  byHandle(handle: string): Promise<string | null>;
  /** Players with this verified phone who allow being found by phone (and are not banned). */
  byPhones(phones: readonly string[]): Promise<string[]>;
  findable(userId: string): Promise<boolean>;
  setFindable(userId: string, value: boolean): Promise<void>;
}

export function createDbFindStore(db: Db): FindStore {
  return {
    async handleOf(userId) {
      const [r] = await db.select({ h: users.handle }).from(users).where(eq(users.id, userId));
      return r?.h ?? null;
    },
    async assignHandle(userId, handle) {
      try {
        await db.update(users).set({ handle }).where(eq(users.id, userId));
        return true;
      } catch {
        return false;
      }
    },
    async byHandle(handle) {
      const [r] = await db.select({ id: users.id }).from(users).where(and(eq(users.handle, handle), eq(users.isBanned, false)));
      return r?.id ?? null;
    },
    async byPhones(phones) {
      if (phones.length === 0) return [];
      const rows = await db.select({ id: users.id }).from(users).where(and(inArray(users.phone, [...phones]), eq(users.findableByPhone, true), eq(users.isBanned, false)));
      return rows.map((r) => r.id);
    },
    async findable(userId) {
      const [r] = await db.select({ f: users.findableByPhone }).from(users).where(eq(users.id, userId));
      return r?.f ?? true;
    },
    async setFindable(userId, value) {
      await db.update(users).set({ findableByPhone: value }).where(eq(users.id, userId));
    },
  };
}

/** Memory store for tests. `phones` maps a verified number to its owner; `banned` hides players. */
export function createMemoryFindStore(): FindStore & { phones: Map<string, string>; banned: Set<string> } {
  const handles = new Map<string, string>();
  const findable = new Map<string, boolean>();
  const phones = new Map<string, string>();
  const banned = new Set<string>();
  return {
    phones,
    banned,
    async handleOf(id) {
      return handles.get(id) ?? null;
    },
    async assignHandle(id, h) {
      if ([...handles.values()].includes(h)) return false;
      handles.set(id, h);
      return true;
    },
    async byHandle(h) {
      const owner = [...handles].find(([, v]) => v === h)?.[0];
      return owner && !banned.has(owner) ? owner : null;
    },
    async byPhones(list) {
      return list.flatMap((p) => {
        const owner = phones.get(p);
        return owner && findable.get(owner) !== false && !banned.has(owner) ? [owner] : [];
      });
    },
    async findable(id) {
      return findable.get(id) ?? true;
    },
    async setFindable(id, v) {
      findable.set(id, v);
    },
  };
}
