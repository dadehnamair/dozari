import { and, asc, cannedTaunts, chatMessages, chatReports, desc, eq, isNull, lt, sql, tauntCategories } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';

export interface TauntRow {
  id: string;
  categoryId: string;
  text: string;
  sortOrder: number;
  isActive: boolean;
}
export interface TauntCategoryRow {
  id: string;
  nameFa: string;
  sortOrder: number;
  isActive: boolean;
  taunts: TauntRow[];
}

export interface MessageRow {
  id: string;
  room: 'city' | 'match';
  roomKey: string;
  userId: string;
  kind: 'text' | 'taunt';
  text: string;
  createdAt: number;
}

export interface ReportRow {
  id: string;
  messageId: string;
  reporterId: string;
  reason: string;
  createdAt: number;
  resolved: boolean;
  messageText: string;
  messageUserId: string;
}

/** Starter taunts (playful, never insulting; brand voice in docs/brand.md). Edited and extended in the admin panel. */
export const DEFAULT_TAUNTS: readonly { nameFa: string; texts: readonly string[] }[] = [
  { nameFa: 'سلام و احوال‌پرسی', texts: ['سلام! آماده‌ای ببازی؟', 'سلام رفیق، دوزاری‌ت رو آماده کن!', 'خوش اومدی به بازی!'] },
  { nameFa: 'لاف‌زنی', texts: ['این یکی رو مامان‌بزرگمم بلد بود 😄', 'قیمت‌ها رو از بر بودم!', 'امروز ستاره‌ی بازی منم ⭐'] },
  { nameFa: 'سربه‌سر', texts: ['پیکان هم این‌قدر کند نبود!', 'دوزاریت هنوز تو راهه؟', 'یکی مونده بود، حیف!'] },
  { nameFa: 'خداقوت', texts: ['دمت گرم، بازی خوبی بود', 'آفرین، حریف قَدی بودی', 'دوباره بازی کنیم؟'] },
  { nameFa: 'واکنش', texts: ['وای نه!', 'عجب!', 'باور نمی‌کنم 😮'] },
];

/** I/O boundary of chat: canned taunts, messages, reports. */
export interface ChatStore {
  taunts(opts?: { includeHidden?: boolean }): Promise<TauntCategoryRow[]>;
  taunt(id: string): Promise<TauntRow | null>;
  addCategory(nameFa: string): Promise<TauntCategoryRow>;
  updateCategory(id: string, patch: { nameFa?: string; isActive?: boolean; sortOrder?: number }): Promise<'ok' | 'not_found'>;
  addTaunt(categoryId: string, text: string): Promise<TauntRow | 'no_category'>;
  updateTaunt(id: string, patch: { text?: string; isActive?: boolean; categoryId?: string; sortOrder?: number }): Promise<'ok' | 'not_found'>;
  addMessage(m: Omit<MessageRow, 'id' | 'createdAt'>): Promise<MessageRow>;
  /** Newest `limit` messages of a room, oldest first (removed ones are left out). */
  history(room: 'city' | 'match', roomKey: string, limit: number): Promise<MessageRow[]>;
  message(id: string): Promise<MessageRow | null>;
  removeMessage(id: string): Promise<boolean>;
  report(messageId: string, reporterId: string, reason: string): Promise<'ok' | 'duplicate' | 'not_found'>;
  reports(opts: { openOnly: boolean; limit: number }): Promise<ReportRow[]>;
  resolveReport(id: string): Promise<boolean>;
  /** Deletes messages older than the cut-off (retention); returns how many. */
  purgeBefore(ms: number): Promise<number>;
}

const toMsg = (r: typeof chatMessages.$inferSelect): MessageRow => ({ id: r.id, room: r.room, roomKey: r.roomKey, userId: r.userId, kind: r.kind, text: r.text, createdAt: r.createdAt.getTime() });

export function createDbChatStore(db: Db): ChatStore {
  let seeded = false;
  const seed = async () => {
    if (seeded) return;
    const [any] = await db.select({ id: tauntCategories.id }).from(tauntCategories).limit(1);
    if (!any) {
      for (const [i, c] of DEFAULT_TAUNTS.entries()) {
        const id = uuidv7();
        await db.insert(tauntCategories).values({ id, nameFa: c.nameFa, sortOrder: i });
        for (const [j, text] of c.texts.entries()) await db.insert(cannedTaunts).values({ id: uuidv7(), categoryId: id, text, sortOrder: j });
      }
    }
    seeded = true;
  };
  return {
    async taunts(opts) {
      await seed();
      const cats = await db.select().from(tauntCategories).where(opts?.includeHidden ? undefined : eq(tauntCategories.isActive, true)).orderBy(asc(tauntCategories.sortOrder));
      const rows = await db.select().from(cannedTaunts).where(opts?.includeHidden ? undefined : eq(cannedTaunts.isActive, true)).orderBy(asc(cannedTaunts.sortOrder));
      return cats.map((c) => ({ ...c, taunts: rows.filter((t) => t.categoryId === c.id) }));
    },
    async taunt(id) {
      await seed();
      const [t] = await db.select().from(cannedTaunts).where(eq(cannedTaunts.id, id));
      return t ?? null;
    },
    async addCategory(nameFa) {
      await seed();
      const [agg] = await db.select({ top: sql<number>`COALESCE(MAX(${tauntCategories.sortOrder}), 0)` }).from(tauntCategories);
      const row = { id: uuidv7(), nameFa, sortOrder: Number(agg?.top ?? 0) + 1, isActive: true };
      await db.insert(tauntCategories).values(row);
      return { ...row, taunts: [] };
    },
    async updateCategory(id, patch) {
      const [r] = await db.select({ id: tauntCategories.id }).from(tauntCategories).where(eq(tauntCategories.id, id));
      if (!r) return 'not_found';
      await db.update(tauntCategories).set(patch).where(eq(tauntCategories.id, id));
      return 'ok';
    },
    async addTaunt(categoryId, text) {
      const [c] = await db.select({ id: tauntCategories.id }).from(tauntCategories).where(eq(tauntCategories.id, categoryId));
      if (!c) return 'no_category';
      const [agg] = await db.select({ top: sql<number>`COALESCE(MAX(${cannedTaunts.sortOrder}), 0)` }).from(cannedTaunts).where(eq(cannedTaunts.categoryId, categoryId));
      const row = { id: uuidv7(), categoryId, text, sortOrder: Number(agg?.top ?? 0) + 1, isActive: true };
      await db.insert(cannedTaunts).values(row);
      return row;
    },
    async updateTaunt(id, patch) {
      const [r] = await db.select({ id: cannedTaunts.id }).from(cannedTaunts).where(eq(cannedTaunts.id, id));
      if (!r) return 'not_found';
      await db.update(cannedTaunts).set(patch).where(eq(cannedTaunts.id, id));
      return 'ok';
    },
    async addMessage(m) {
      const id = uuidv7();
      await db.insert(chatMessages).values({ id, ...m });
      const [r] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
      return toMsg(r!);
    },
    async history(room, roomKey, limit) {
      const rows = await db.select().from(chatMessages).where(and(eq(chatMessages.room, room), eq(chatMessages.roomKey, roomKey), isNull(chatMessages.deletedAt))).orderBy(desc(chatMessages.createdAt)).limit(limit);
      return rows.map(toMsg).reverse();
    },
    async message(id) {
      const [r] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
      return r ? toMsg(r) : null;
    },
    async removeMessage(id) {
      const [r] = await db.select({ id: chatMessages.id }).from(chatMessages).where(and(eq(chatMessages.id, id), isNull(chatMessages.deletedAt)));
      if (!r) return false;
      await db.update(chatMessages).set({ deletedAt: new Date() }).where(eq(chatMessages.id, id));
      return true;
    },
    async report(messageId, reporterId, reason) {
      const [m] = await db.select({ id: chatMessages.id }).from(chatMessages).where(eq(chatMessages.id, messageId));
      if (!m) return 'not_found';
      try {
        await db.insert(chatReports).values({ id: uuidv7(), messageId, reporterId, reason });
      } catch {
        return 'duplicate';
      }
      return 'ok';
    },
    async reports({ openOnly, limit }) {
      const rows = await db
        .select({ r: chatReports, m: chatMessages })
        .from(chatReports)
        .innerJoin(chatMessages, eq(chatMessages.id, chatReports.messageId))
        .where(openOnly ? isNull(chatReports.resolvedAt) : undefined)
        .orderBy(desc(chatReports.createdAt))
        .limit(limit);
      return rows.map(({ r, m }) => ({ id: r.id, messageId: r.messageId, reporterId: r.reporterId, reason: r.reason, createdAt: r.createdAt.getTime(), resolved: r.resolvedAt !== null, messageText: m.text, messageUserId: m.userId }));
    },
    async resolveReport(id) {
      const [r] = await db.select({ id: chatReports.id }).from(chatReports).where(and(eq(chatReports.id, id), isNull(chatReports.resolvedAt)));
      if (!r) return false;
      await db.update(chatReports).set({ resolvedAt: new Date() }).where(eq(chatReports.id, id));
      return true;
    },
    async purgeBefore(ms) {
      const old = await db.select({ id: chatMessages.id }).from(chatMessages).where(lt(chatMessages.createdAt, new Date(ms)));
      if (old.length === 0) return 0;
      await db.delete(chatMessages).where(lt(chatMessages.createdAt, new Date(ms)));
      return old.length;
    },
  };
}


export function createMemoryChatStore(): ChatStore & { clock: { ms: number } } {
  const clock = { ms: Date.now() };
  const cats: TauntCategoryRow[] = DEFAULT_TAUNTS.map((c, i) => ({
    id: `00000000-0000-7000-8000-${String(i + 1).padStart(12, '0')}`,
    nameFa: c.nameFa,
    sortOrder: i,
    isActive: true,
    taunts: c.texts.map((text, j) => ({ id: `00000000-0000-7000-9000-${String(i * 10 + j + 1).padStart(12, '0')}`, categoryId: `00000000-0000-7000-8000-${String(i + 1).padStart(12, '0')}`, text, sortOrder: j, isActive: true })),
  }));
  const msgs: (MessageRow & { deleted: boolean })[] = [];
  const reports: { id: string; messageId: string; reporterId: string; reason: string; createdAt: number; resolved: boolean }[] = [];
  let seq = 0;
  const id = () => `00000000-0000-7000-a000-${String(++seq).padStart(12, '0')}`;
  const allTaunts = () => cats.flatMap((c) => c.taunts);
  return {
    clock,
    async taunts(opts) {
      return cats
        .filter((c) => opts?.includeHidden || c.isActive)
        .map((c) => ({ ...c, taunts: c.taunts.filter((t) => opts?.includeHidden || t.isActive).map((t) => ({ ...t })) }));
    },
    async taunt(tid) {
      const t = allTaunts().find((x) => x.id === tid);
      return t ? { ...t } : null;
    },
    async addCategory(nameFa) {
      const c = { id: id(), nameFa, sortOrder: cats.length, isActive: true, taunts: [] as TauntRow[] };
      cats.push(c);
      return { ...c };
    },
    async updateCategory(cid, patch) {
      const c = cats.find((x) => x.id === cid);
      if (!c) return 'not_found';
      Object.assign(c, patch);
      return 'ok';
    },
    async addTaunt(categoryId, text) {
      const c = cats.find((x) => x.id === categoryId);
      if (!c) return 'no_category';
      const t = { id: id(), categoryId, text, sortOrder: c.taunts.length, isActive: true };
      c.taunts.push(t);
      return { ...t };
    },
    async updateTaunt(tid, patch) {
      const t = allTaunts().find((x) => x.id === tid);
      if (!t) return 'not_found';
      Object.assign(t, patch);
      return 'ok';
    },
    async addMessage(m) {
      const row = { ...m, id: id(), createdAt: clock.ms + seq, deleted: false };
      msgs.push(row);
      return { id: row.id, room: row.room, roomKey: row.roomKey, userId: row.userId, kind: row.kind, text: row.text, createdAt: row.createdAt };
    },
    async history(room, key, limit) {
      return msgs.filter((m) => m.room === room && m.roomKey === key && !m.deleted).slice(-limit).map(({ deleted: _d, ...m }) => ({ ...m }));
    },
    async message(mid) {
      const m = msgs.find((x) => x.id === mid);
      return m ? { id: m.id, room: m.room, roomKey: m.roomKey, userId: m.userId, kind: m.kind, text: m.text, createdAt: m.createdAt } : null;
    },
    async removeMessage(mid) {
      const m = msgs.find((x) => x.id === mid && !x.deleted);
      if (!m) return false;
      m.deleted = true;
      return true;
    },
    async report(messageId, reporterId, reason) {
      if (!msgs.some((m) => m.id === messageId)) return 'not_found';
      if (reports.some((r) => r.messageId === messageId && r.reporterId === reporterId)) return 'duplicate';
      reports.push({ id: id(), messageId, reporterId, reason, createdAt: clock.ms, resolved: false });
      return 'ok';
    },
    async reports({ openOnly, limit }) {
      return reports
        .filter((r) => !openOnly || !r.resolved)
        .slice(-limit)
        .map((r) => {
          const m = msgs.find((x) => x.id === r.messageId)!;
          return { ...r, messageText: m.text, messageUserId: m.userId };
        });
    },
    async resolveReport(rid) {
      const r = reports.find((x) => x.id === rid && !x.resolved);
      if (!r) return false;
      r.resolved = true;
      return true;
    },
    async purgeBefore(ms) {
      const keep = msgs.filter((m) => m.createdAt >= ms);
      const n = msgs.length - keep.length;
      msgs.length = 0;
      msgs.push(...keep);
      return n;
    },
  };
}
