import { adminAuditLog, desc } from '@dozari/db';
import type { Db } from '@dozari/db';
import { AsyncLocalStorage } from 'node:async_hooks';
import { uuidv7 } from 'uuidv7';

/** The admin account behind the request being handled, so audit rows can name who did it. */
export const auditActor = new AsyncLocalStorage<string>();

export interface AuditEntry {
  id: string;
  at: number;
  action: string;
  actor: string | null;
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
        await db.insert(adminAuditLog).values({ id: uuidv7(), action, actor: auditActor.getStore() ?? null, target: target.slice(0, 200), detail: detail ?? null });
      } catch {
        /* the audit trail is best effort */
      }
    },
    async recent(limit) {
      const rows = await db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.at)).limit(limit);
      return rows.map((r) => ({ id: r.id, at: r.at.getTime(), action: r.action, actor: r.actor, target: r.target, detail: r.detail }));
    },
  };
}

export function createMemoryAuditLog(): AuditLog & { entries: AuditEntry[] } {
  const entries: AuditEntry[] = [];
  return {
    entries,
    async record(action, target, detail) {
      entries.unshift({ id: String(entries.length + 1), at: Date.now(), action, actor: auditActor.getStore() ?? null, target, detail: detail ?? null });
    },
    async recent(limit) {
      return entries.slice(0, limit);
    },
  };
}
