import { and, eq, friendContacts, inArray, sql, users } from '@dozari/db';
import type { Db } from '@dozari/db';

/** I/O boundary of finding players: public IDs, phone lookup, the phone-findability switch. */
export interface FindStore {
  handleOf(userId: string): Promise<string | null>;
  /** False when the ID is already taken. */
  assignHandle(userId: string, handle: string): Promise<boolean>;
  byHandle(handle: string): Promise<string | null>;
  /** Players with this verified phone who allow being found by phone (and are not banned), with the number that matched. */
  byPhones(phones: readonly string[]): Promise<{ id: string; phone: string }[]>;
  /** Remembers, for `owner` only, the address-book name and number of each player found (replaces an older note). */
  saveContacts(owner: string, notes: readonly { friendId: string; name: string; phone: string }[]): Promise<void>;
  /** `owner`'s notes about these players. */
  contactsOf(owner: string, ids: readonly string[]): Promise<Map<string, { name: string; phone: string }>>;
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
      const rows = await db.select({ id: users.id, phone: users.phone }).from(users).where(and(inArray(users.phone, [...phones]), eq(users.findableByPhone, true), eq(users.isBanned, false)));
      return rows.flatMap((r) => (r.phone ? [{ id: r.id, phone: r.phone }] : []));
    },
    async saveContacts(owner, notes) {
      if (notes.length === 0) return;
      // An empty name (contact without one, or the name-less `phones` form) never wipes a name saved earlier.
      await db
        .insert(friendContacts)
        .values(notes.map((n) => ({ ownerId: owner, friendId: n.friendId, contactName: n.name, phone: n.phone })))
        .onDuplicateKeyUpdate({ set: { contactName: sql`if(values(${friendContacts.contactName}) = '', ${friendContacts.contactName}, values(${friendContacts.contactName}))`, phone: sql`values(${friendContacts.phone})`, updatedAt: new Date() } });
    },
    async contactsOf(owner, ids) {
      if (ids.length === 0) return new Map();
      const rows = await db.select().from(friendContacts).where(and(eq(friendContacts.ownerId, owner), inArray(friendContacts.friendId, [...ids])));
      return new Map(rows.map((r) => [r.friendId, { name: r.contactName, phone: r.phone }]));
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
  const notesMap = new Map<string, { name: string; phone: string }>();
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
        return owner && findable.get(owner) !== false && !banned.has(owner) ? [{ id: owner, phone: p }] : [];
      });
    },
    async saveContacts(owner, notes) {
      for (const n of notes) notesMap.set(`${owner}:${n.friendId}`, { name: n.name || notesMap.get(`${owner}:${n.friendId}`)?.name || '', phone: n.phone });
    },
    async contactsOf(owner, ids) {
      return new Map(ids.flatMap((id) => (notesMap.has(`${owner}:${id}`) ? [[id, notesMap.get(`${owner}:${id}`)!] as const] : [])));
    },
    async findable(id) {
      return findable.get(id) ?? true;
    },
    async setFindable(id, v) {
      findable.set(id, v);
    },
  };
}
