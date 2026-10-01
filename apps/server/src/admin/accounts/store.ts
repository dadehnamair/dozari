import { adminUsers, eq } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';
import type { Role } from './permissions.js';

export interface AdminRecord {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  failedLogins: number;
  lockedUntil: number | null;
  sessionVersion: number;
  createdAt: number;
  lastLoginAt: number | null;
}

/** I/O boundary of the admin accounts. */
export interface AdminStore {
  list(): Promise<AdminRecord[]>;
  byUsername(username: string): Promise<AdminRecord | null>;
  byId(id: string): Promise<AdminRecord | null>;
  create(input: { username: string; displayName: string; passwordHash: string; role: Role }): Promise<AdminRecord | 'duplicate'>;
  update(id: string, patch: Partial<Pick<AdminRecord, 'displayName' | 'role' | 'isActive' | 'passwordHash' | 'failedLogins' | 'lockedUntil' | 'sessionVersion' | 'lastLoginAt'>>): Promise<boolean>;
}

const toRecord = (r: typeof adminUsers.$inferSelect): AdminRecord => ({
  id: r.id,
  username: r.username,
  displayName: r.displayName,
  passwordHash: r.passwordHash,
  role: r.role,
  isActive: r.isActive,
  failedLogins: r.failedLogins,
  lockedUntil: r.lockedUntil?.getTime() ?? null,
  sessionVersion: r.sessionVersion,
  createdAt: r.createdAt.getTime(),
  lastLoginAt: r.lastLoginAt?.getTime() ?? null,
});

function isDuplicateKey(err: unknown): boolean {
  const e = err as { code?: string; errno?: number; cause?: unknown } | null;
  return Boolean(e && (e.code === 'ER_DUP_ENTRY' || e.errno === 1062 || isDuplicateKey(e.cause)));
}

export function createDbAdminStore(db: Db): AdminStore {
  return {
    async list() {
      return (await db.select().from(adminUsers).orderBy(adminUsers.createdAt)).map(toRecord);
    },
    async byUsername(username) {
      const [r] = await db.select().from(adminUsers).where(eq(adminUsers.username, username));
      return r ? toRecord(r) : null;
    },
    async byId(id) {
      const [r] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
      return r ? toRecord(r) : null;
    },
    async create(input) {
      const id = uuidv7();
      try {
        await db.insert(adminUsers).values({ id, ...input });
      } catch (err) {
        if (isDuplicateKey(err)) return 'duplicate';
        throw err;
      }
      return toRecord((await db.select().from(adminUsers).where(eq(adminUsers.id, id)))[0]!);
    },
    async update(id, patch) {
      const set: Partial<typeof adminUsers.$inferInsert> = {};
      if (patch.displayName !== undefined) set.displayName = patch.displayName;
      if (patch.role !== undefined) set.role = patch.role;
      if (patch.isActive !== undefined) set.isActive = patch.isActive;
      if (patch.passwordHash !== undefined) set.passwordHash = patch.passwordHash;
      if (patch.failedLogins !== undefined) set.failedLogins = patch.failedLogins;
      if (patch.lockedUntil !== undefined) set.lockedUntil = patch.lockedUntil === null ? null : new Date(patch.lockedUntil);
      if (patch.sessionVersion !== undefined) set.sessionVersion = patch.sessionVersion;
      if (patch.lastLoginAt !== undefined) set.lastLoginAt = patch.lastLoginAt === null ? null : new Date(patch.lastLoginAt);
      if (Object.keys(set).length === 0) return false;
      const [r] = await db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.id, id));
      if (!r) return false;
      await db.update(adminUsers).set(set).where(eq(adminUsers.id, id));
      return true;
    },
  };
}

export function createMemoryAdminStore(): AdminStore {
  const rows: AdminRecord[] = [];
  return {
    async list() {
      return rows.map((r) => ({ ...r }));
    },
    async byUsername(u) {
      const r = rows.find((x) => x.username === u);
      return r ? { ...r } : null;
    },
    async byId(id) {
      const r = rows.find((x) => x.id === id);
      return r ? { ...r } : null;
    },
    async create(input) {
      if (rows.some((r) => r.username === input.username)) return 'duplicate';
      const rec: AdminRecord = { id: uuidv7(), ...input, isActive: true, failedLogins: 0, lockedUntil: null, sessionVersion: 1, createdAt: Date.now(), lastLoginAt: null };
      rows.push(rec);
      return { ...rec };
    },
    async update(id, patch) {
      const r = rows.find((x) => x.id === id);
      if (!r) return false;
      Object.assign(r, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
      return true;
    },
  };
}
