import { asc, desc, eq, shortLinks, sql } from '@dozari/db';
import type { Db } from '@dozari/db';

export interface ShortLinkRow {
  code: string;
  targetUrl: string;
  note: string;
  clicks: number;
  isActive: boolean;
  createdAt: number;
  lastClickAt: number | null;
}

/** I/O boundary of the short links. */
export interface ShortLinkStore {
  list(limit: number): Promise<ShortLinkRow[]>;
  get(code: string): Promise<ShortLinkRow | null>;
  /** 'taken' when the code exists. */
  create(code: string, targetUrl: string, note: string): Promise<'ok' | 'taken'>;
  update(code: string, patch: Partial<Pick<ShortLinkRow, 'targetUrl' | 'note' | 'isActive'>>): Promise<'ok' | 'not_found'>;
  /** Counts one click (best effort). */
  click(code: string): Promise<void>;
}

const toRow = (r: typeof shortLinks.$inferSelect): ShortLinkRow => ({ code: r.code, targetUrl: r.targetUrl, note: r.note, clicks: r.clicks, isActive: r.isActive, createdAt: r.createdAt.getTime(), lastClickAt: r.lastClickAt ? r.lastClickAt.getTime() : null });

export function createDbShortLinkStore(db: Db): ShortLinkStore {
  return {
    async list(limit) {
      return (await db.select().from(shortLinks).orderBy(desc(shortLinks.createdAt), asc(shortLinks.code)).limit(limit)).map(toRow);
    },
    async get(code) {
      const [r] = await db.select().from(shortLinks).where(eq(shortLinks.code, code));
      return r ? toRow(r) : null;
    },
    async create(code, targetUrl, note) {
      const [res] = await db.insert(shortLinks).ignore().values({ code, targetUrl, note });
      return res.affectedRows > 0 ? 'ok' : 'taken';
    },
    async update(code, patch) {
      const [r] = await db.select({ code: shortLinks.code }).from(shortLinks).where(eq(shortLinks.code, code));
      if (!r) return 'not_found';
      if (Object.keys(patch).length > 0) await db.update(shortLinks).set(patch).where(eq(shortLinks.code, code));
      return 'ok';
    },
    async click(code) {
      await db.update(shortLinks).set({ clicks: sql`${shortLinks.clicks} + 1`, lastClickAt: new Date() }).where(eq(shortLinks.code, code));
    },
  };
}

/** In-memory twin for tests. */
export function createMemoryShortLinkStore(now: () => number = Date.now): ShortLinkStore {
  const rows = new Map<string, ShortLinkRow>();
  return {
    async list(limit) {
      return [...rows.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit).map((r) => ({ ...r }));
    },
    async get(code) {
      const r = rows.get(code);
      return r ? { ...r } : null;
    },
    async create(code, targetUrl, note) {
      if (rows.has(code)) return 'taken';
      rows.set(code, { code, targetUrl, note, clicks: 0, isActive: true, createdAt: now(), lastClickAt: null });
      return 'ok';
    },
    async update(code, patch) {
      const r = rows.get(code);
      if (!r) return 'not_found';
      Object.assign(r, patch);
      return 'ok';
    },
    async click(code) {
      const r = rows.get(code);
      if (r) {
        r.clicks += 1;
        r.lastClickAt = now();
      }
    },
  };
}
