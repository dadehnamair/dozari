import { adminAuditLog, desc } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';

export interface AuditEntry {
  id: string;
  at: number;
  action: string;
  target: string;
  detail: string | null;
}

/** What the admin changed, newest first. Writing must never break the action it records. */
export interface AuditLog {
  record(action: string, target: string, detail?: string): Promise<void>;
  recent(limit: number): Promise<AuditEntry[]>;
}

export function createDbAuditLog(db: Db): AuditLog {
  return {
    async record(action, target, detail) {
      try {
        await db.insert(adminAuditLog).values({ id: uuidv7(), action, target: target.slice(0, 200), detail: detail ?? null });
      } catch {
        /* the audit trail is best effort */
      }
    },
    async recent(limit) {
      const rows = await db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.at)).limit(limit);
      return rows.map((r) => ({ id: r.id, at: r.at.getTime(), action: r.action, target: r.target, detail: r.detail }));
    },
  };
}

export function createMemoryAuditLog(): AuditLog & { entries: AuditEntry[] } {
  const entries: AuditEntry[] = [];
  return {
    entries,
    async record(action, target, detail) {
      entries.unshift({ id: String(entries.length + 1), at: Date.now(), action, target, detail: detail ?? null });
    },
    async recent(limit) {
      return entries.slice(0, limit);
    },
  };
}
