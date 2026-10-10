import { and, clientErrors, desc, eq, isNull, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';
import type { ClientErrorInput, ClientErrorRow } from '@dozari/shared';

/** I/O boundary of the app's error reports. */
export interface ClientErrorStore {
  add(userId: string | null, input: ClientErrorInput, now: number): Promise<string>;
  list(limit: number): Promise<ClientErrorRow[]>;
  screenshot(id: string): Promise<string | null>;
  resolve(id: string, now: number): Promise<boolean>;
  openCount(): Promise<number>;
}

export function createMemoryClientErrorStore(): ClientErrorStore {
  const rows = new Map<string, { row: ClientErrorRow; shot: string | null }>();
  return {
    async add(userId, input, now) {
      const id = uuidv7();
      rows.set(id, { row: { id, userId, userName: null, kind: input.kind, screen: input.screen, message: input.message, detail: input.detail, context: input.context, note: input.note, hasScreenshot: !!input.screenshot, createdAt: now, resolved: false }, shot: input.screenshot ?? null });
      return id;
    },
    async list(limit) {
      return [...rows.values()].map((r) => r.row).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
    },
    async screenshot(id) {
      return rows.get(id)?.shot ?? null;
    },
    async resolve(id) {
      const r = rows.get(id);
      if (!r || r.row.resolved) return false;
      r.row.resolved = true;
      return true;
    },
    async openCount() {
      return [...rows.values()].filter((r) => !r.row.resolved).length;
    },
  };
}

export function createDbClientErrorStore(db: Db): ClientErrorStore {
  return {
    async add(userId, input, now) {
      const id = uuidv7();
      await db.insert(clientErrors).values({ id, userId, kind: input.kind, screen: input.screen, message: input.message, detail: input.detail, context: input.context, note: input.note, screenshot: input.screenshot ?? null, createdAt: new Date(now) });
      return id;
    },
    async list(limit) {
      const rows = await db
        .select({ id: clientErrors.id, userId: clientErrors.userId, userName: users.nickname, kind: clientErrors.kind, screen: clientErrors.screen, message: clientErrors.message, detail: clientErrors.detail, context: clientErrors.context, note: clientErrors.note, hasShot: clientErrors.screenshot, createdAt: clientErrors.createdAt, resolvedAt: clientErrors.resolvedAt })
        .from(clientErrors)
        .leftJoin(users, eq(users.id, clientErrors.userId))
        .orderBy(desc(clientErrors.createdAt))
        .limit(limit);
      return rows.map((r) => ({ id: r.id, userId: r.userId, userName: r.userName ?? null, kind: r.kind, screen: r.screen, message: r.message, detail: r.detail ?? '', context: r.context, note: r.note, hasScreenshot: r.hasShot !== null && r.hasShot.length > 0, createdAt: r.createdAt.getTime(), resolved: r.resolvedAt !== null }));
    },
    async screenshot(id) {
      const [r] = await db.select({ s: clientErrors.screenshot }).from(clientErrors).where(eq(clientErrors.id, id));
      return r?.s ?? null;
    },
    async resolve(id, now) {
      const [res] = await db.update(clientErrors).set({ resolvedAt: new Date(now) }).where(and(eq(clientErrors.id, id), isNull(clientErrors.resolvedAt)));
      return res.affectedRows > 0;
    },
    async openCount() {
      const rows = await db.select({ id: clientErrors.id }).from(clientErrors).where(isNull(clientErrors.resolvedAt)).limit(1000);
      return rows.length;
    },
  };
}
