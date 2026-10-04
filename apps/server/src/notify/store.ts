import { and, asc, baleLinkCodes, baleLinks, count, desc, eq, isNull, lt, notificationOutbox, or, userDailyRewards } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';

export interface OutboxRow {
  id: string;
  chatId: string;
  userId: string | null;
  kind: string;
  text: string;
  attempts: number;
}

export interface OutboxStats {
  pending: number;
  sent: number;
  failed: number;
  recent: { id: string; kind: string; status: string; text: string; lastError: string | null; at: number }[];
}

/** I/O boundary of the Bale integration: links, one-time codes and the outbox. */
export interface NotifyStore {
  chatOf(userId: string): Promise<string | null>;
  /** The player a Bale chat is linked to, if any. */
  userOfChat(chatId: string): Promise<string | null>;
  allLinked(): Promise<{ userId: string; chatId: string }[]>;
  createCode(userId: string, code: string, expiresAt: number): Promise<void>;
  /** Consumes a live code and links the chat to its user (an older link of either side is replaced); null = unknown/expired. */
  redeemCode(code: string, chatId: string, now: number): Promise<{ userId: string } | null>;
  /** Removes the link of a chat; true if there was one. */
  unlinkChat(chatId: string): Promise<boolean>;
  unlinkUser(userId: string): Promise<boolean>;
  enqueue(row: { chatId: string; userId: string | null; kind: string; text: string }): Promise<void>;
  takePending(limit: number): Promise<OutboxRow[]>;
  markSent(id: string, now: number): Promise<void>;
  /** Records a failed attempt; after `maxAttempts` the row is parked as failed, else it stays pending. */
  markAttempt(id: string, error: string, maxAttempts: number): Promise<void>;
  stats(): Promise<OutboxStats>;
  linkedCount(): Promise<number>;
  /** Linked players whose daily reward has opened since the claim we last announced; `markDailyNotified` records it. */
  dailyDue(now: number, cooldownMs: number): Promise<{ userId: string; chatId: string; claimedAt: number }[]>;
  markDailyNotified(userId: string, claimedAt: number): Promise<void>;
}

const short = (s: string) => s.slice(0, 300);

export function createDbNotifyStore(db: Db): NotifyStore {
  return {
    async chatOf(userId) {
      const [r] = await db.select({ chatId: baleLinks.chatId }).from(baleLinks).where(eq(baleLinks.userId, userId));
      return r?.chatId ?? null;
    },
    async userOfChat(chatId) {
      const [r] = await db.select({ userId: baleLinks.userId }).from(baleLinks).where(eq(baleLinks.chatId, chatId));
      return r?.userId ?? null;
    },
    allLinked: () => db.select({ userId: baleLinks.userId, chatId: baleLinks.chatId }).from(baleLinks),
    async createCode(userId, code, expiresAt) {
      await db.delete(baleLinkCodes).where(eq(baleLinkCodes.userId, userId));
      await db.insert(baleLinkCodes).values({ code, userId, expiresAt: new Date(expiresAt) });
    },
    async redeemCode(code, chatId, now) {
      return db.transaction(async (tx) => {
        const [row] = await tx.select().from(baleLinkCodes).where(eq(baleLinkCodes.code, code)).for('update');
        if (!row) return null;
        await tx.delete(baleLinkCodes).where(eq(baleLinkCodes.code, code));
        if (row.expiresAt.getTime() < now) return null;
        await tx.delete(baleLinks).where(or(eq(baleLinks.userId, row.userId), eq(baleLinks.chatId, chatId)));
        await tx.insert(baleLinks).values({ userId: row.userId, chatId, linkedAt: new Date(now) });
        return { userId: row.userId };
      });
    },
    async unlinkChat(chatId) {
      const [r] = await db.select({ userId: baleLinks.userId }).from(baleLinks).where(eq(baleLinks.chatId, chatId));
      if (!r) return false;
      await db.delete(baleLinks).where(eq(baleLinks.chatId, chatId));
      return true;
    },
    async unlinkUser(userId) {
      const [r] = await db.select({ userId: baleLinks.userId }).from(baleLinks).where(eq(baleLinks.userId, userId));
      if (!r) return false;
      await db.delete(baleLinks).where(eq(baleLinks.userId, userId));
      return true;
    },
    async enqueue(row) {
      await db.insert(notificationOutbox).values({ id: uuidv7(), ...row });
    },
    async takePending(limit) {
      const rows = await db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.status, 'pending'))
        .orderBy(asc(notificationOutbox.createdAt))
        .limit(limit);
      return rows.map((r) => ({ id: r.id, chatId: r.chatId, userId: r.userId, kind: r.kind, text: r.text, attempts: r.attempts }));
    },
    async markSent(id, now) {
      await db.update(notificationOutbox).set({ status: 'sent', sentAt: new Date(now), lastError: null }).where(eq(notificationOutbox.id, id));
    },
    async markAttempt(id, error, maxAttempts) {
      const [r] = await db.select({ attempts: notificationOutbox.attempts }).from(notificationOutbox).where(eq(notificationOutbox.id, id));
      const attempts = (r?.attempts ?? 0) + 1;
      await db
        .update(notificationOutbox)
        .set({ attempts, lastError: short(error), status: attempts >= maxAttempts ? 'failed' : 'pending' })
        .where(eq(notificationOutbox.id, id));
    },
    async stats() {
      const counts = await db.select({ status: notificationOutbox.status, n: count() }).from(notificationOutbox).groupBy(notificationOutbox.status);
      const n = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;
      const recent = await db.select().from(notificationOutbox).orderBy(desc(notificationOutbox.createdAt)).limit(20);
      return {
        pending: n('pending'),
        sent: n('sent'),
        failed: n('failed'),
        recent: recent.map((r) => ({ id: r.id, kind: r.kind, status: r.status, text: r.text, lastError: r.lastError, at: r.createdAt.getTime() })),
      };
    },
    async linkedCount() {
      const [r] = await db.select({ n: count() }).from(baleLinks);
      return r?.n ?? 0;
    },
    async dailyDue(now, cooldownMs) {
      const openedBefore = new Date(now - cooldownMs);
      const rows = await db
        .select({ userId: baleLinks.userId, chatId: baleLinks.chatId, claimedAt: userDailyRewards.lastClaimedAt })
        .from(baleLinks)
        .innerJoin(userDailyRewards, eq(userDailyRewards.userId, baleLinks.userId))
        .where(and(lt(userDailyRewards.lastClaimedAt, openedBefore), or(isNull(baleLinks.dailyNotifiedFor), lt(baleLinks.dailyNotifiedFor, userDailyRewards.lastClaimedAt))));
      return rows.map((r) => ({ userId: r.userId, chatId: r.chatId, claimedAt: r.claimedAt.getTime() }));
    },
    async markDailyNotified(userId, claimedAt) {
      await db.update(baleLinks).set({ dailyNotifiedFor: new Date(claimedAt) }).where(eq(baleLinks.userId, userId));
    },
  };
}

export function createMemoryNotifyStore(): NotifyStore & { outbox: (OutboxRow & { status: string; lastError: string | null; at: number })[]; setClaim(userId: string, claimedAt: number): void } {
  const links = new Map<string, { chatId: string; dailyNotifiedFor: number | null }>();
  const codes = new Map<string, { userId: string; expiresAt: number }>();
  const claims = new Map<string, number>();
  const outbox: (OutboxRow & { status: string; lastError: string | null; at: number })[] = [];
  let seq = 0;
  return {
    outbox,
    setClaim: (userId, claimedAt) => void claims.set(userId, claimedAt),
    async chatOf(userId) {
      return links.get(userId)?.chatId ?? null;
    },
    async userOfChat(chatId) {
      return [...links].find(([, l]) => l.chatId === chatId)?.[0] ?? null;
    },
    async allLinked() {
      return [...links].map(([userId, l]) => ({ userId, chatId: l.chatId }));
    },
    async createCode(userId, code, expiresAt) {
      for (const [c, v] of codes) if (v.userId === userId) codes.delete(c);
      codes.set(code, { userId, expiresAt });
    },
    async redeemCode(code, chatId, now) {
      const row = codes.get(code);
      if (!row) return null;
      codes.delete(code);
      if (row.expiresAt < now) return null;
      for (const [u, l] of links) if (u === row.userId || l.chatId === chatId) links.delete(u);
      links.set(row.userId, { chatId, dailyNotifiedFor: null });
      return { userId: row.userId };
    },
    async unlinkChat(chatId) {
      for (const [u, l] of links) if (l.chatId === chatId) return links.delete(u);
      return false;
    },
    async unlinkUser(userId) {
      return links.delete(userId);
    },
    async enqueue(row) {
      outbox.push({ id: String(++seq), ...row, attempts: 0, status: 'pending', lastError: null, at: Date.now() });
    },
    async takePending(limit) {
      return outbox.filter((o) => o.status === 'pending').slice(0, limit);
    },
    async markSent(id) {
      const o = outbox.find((x) => x.id === id);
      if (o) o.status = 'sent';
    },
    async markAttempt(id, error, maxAttempts) {
      const o = outbox.find((x) => x.id === id);
      if (!o) return;
      o.attempts += 1;
      o.lastError = short(error);
      o.status = o.attempts >= maxAttempts ? 'failed' : 'pending';
    },
    async stats() {
      const n = (s: string) => outbox.filter((o) => o.status === s).length;
      return { pending: n('pending'), sent: n('sent'), failed: n('failed'), recent: outbox.slice(-20).map((o) => ({ id: o.id, kind: o.kind, status: o.status, text: o.text, lastError: o.lastError, at: o.at })) };
    },
    async linkedCount() {
      return links.size;
    },
    async dailyDue(now, cooldownMs) {
      const out: { userId: string; chatId: string; claimedAt: number }[] = [];
      for (const [userId, l] of links) {
        const claimedAt = claims.get(userId);
        if (claimedAt === undefined || claimedAt + cooldownMs > now) continue;
        if (l.dailyNotifiedFor !== null && l.dailyNotifiedFor >= claimedAt) continue;
        out.push({ userId, chatId: l.chatId, claimedAt });
      }
      return out;
    },
    async markDailyNotified(userId, claimedAt) {
      const l = links.get(userId);
      if (l) l.dailyNotifiedFor = claimedAt;
    },
  };
}
