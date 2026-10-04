import { adminMessageChannels, adminMessages, and, baleLinks, desc, eq, inArray, inboxMessages, isNull, sql, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';

export type Audience = 'all' | 'bale_linked' | 'user';
export type Channel = 'in_app' | 'bale' | 'sms' | 'email' | 'push';

export interface NewMessage {
  title: string;
  body: string;
  audience: Audience;
  targetUserId: string | null;
}

export interface SentMessage extends NewMessage {
  id: string;
  sentAt: number;
  retracted: boolean;
  channels: { channel: Channel; recipients: number }[];
}

/** One player who got a message in their in-app inbox (admin "who did this go to" view). */
export interface MessageRecipient {
  userId: string;
  nickname: string | null;
  read: boolean;
}

export interface InboxItem {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
}

/** I/O boundary of the message center: sent messages, their channel counts and the players' inboxes. */
export interface MessageStore {
  /** Non-banned players of an audience. */
  audienceUsers(audience: Audience, userId: string | null): Promise<string[]>;
  create(msg: NewMessage): Promise<string>;
  setChannel(messageId: string, channel: Channel, recipients: number): Promise<void>;
  deliverInbox(messageId: string, userIds: readonly string[]): Promise<void>;
  list(limit: number): Promise<SentMessage[]>;
  /** Players whose inbox received the message (in-app channel only; other channels keep just a count). */
  recipients(messageId: string, limit: number): Promise<MessageRecipient[]>;
  /** Hides the message from every inbox; false when unknown or already retracted. */
  retract(messageId: string, now: number): Promise<boolean>;
  inbox(userId: string, limit: number): Promise<InboxItem[]>;
  unread(userId: string): Promise<number>;
  markRead(userId: string, inboxId: string, now: number): Promise<boolean>;
  markAllRead(userId: string, now: number): Promise<void>;
}

export function createDbMessageStore(db: Db): MessageStore {
  return {
    async audienceUsers(audience, userId) {
      if (audience === 'user') {
        if (!userId) return [];
        const [r] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.isBanned, false)));
        return r ? [r.id] : [];
      }
      if (audience === 'bale_linked') {
        const rows = await db.select({ id: users.id }).from(baleLinks).innerJoin(users, eq(users.id, baleLinks.userId)).where(eq(users.isBanned, false));
        return rows.map((r) => r.id);
      }
      return (await db.select({ id: users.id }).from(users).where(eq(users.isBanned, false))).map((r) => r.id);
    },
    async create(msg) {
      const id = uuidv7();
      await db.insert(adminMessages).values({ id, ...msg });
      return id;
    },
    async setChannel(messageId, channel, recipients) {
      await db.insert(adminMessageChannels).values({ messageId, channel, recipients });
    },
    async deliverInbox(messageId, userIds) {
      for (let i = 0; i < userIds.length; i += 500) {
        await db.insert(inboxMessages).values(userIds.slice(i, i + 500).map((userId) => ({ id: uuidv7(), userId, messageId })));
      }
    },
    async list(limit) {
      const rows = await db.select().from(adminMessages).orderBy(desc(adminMessages.sentAt)).limit(limit);
      if (rows.length === 0) return [];
      const ch = await db.select().from(adminMessageChannels).where(inArray(adminMessageChannels.messageId, rows.map((r) => r.id)));
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        audience: r.audience,
        targetUserId: r.targetUserId,
        sentAt: r.sentAt.getTime(),
        retracted: r.retractedAt !== null,
        channels: ch.filter((c) => c.messageId === r.id).map((c) => ({ channel: c.channel, recipients: c.recipients })),
      }));
    },
    async recipients(messageId, limit) {
      const rows = await db
        .select({ userId: inboxMessages.userId, nickname: users.nickname, readAt: inboxMessages.readAt })
        .from(inboxMessages)
        .innerJoin(users, eq(users.id, inboxMessages.userId))
        .where(eq(inboxMessages.messageId, messageId))
        .orderBy(users.nickname)
        .limit(limit);
      return rows.map((r) => ({ userId: r.userId, nickname: r.nickname, read: r.readAt !== null }));
    },
    async retract(messageId, now) {
      const [r] = await db.select({ id: adminMessages.id }).from(adminMessages).where(and(eq(adminMessages.id, messageId), isNull(adminMessages.retractedAt)));
      if (!r) return false;
      await db.update(adminMessages).set({ retractedAt: new Date(now) }).where(eq(adminMessages.id, messageId));
      return true;
    },
    async inbox(userId, limit) {
      const rows = await db
        .select({ id: inboxMessages.id, title: adminMessages.title, body: adminMessages.body, createdAt: inboxMessages.createdAt, readAt: inboxMessages.readAt })
        .from(inboxMessages)
        .innerJoin(adminMessages, eq(adminMessages.id, inboxMessages.messageId))
        .where(and(eq(inboxMessages.userId, userId), isNull(adminMessages.retractedAt)))
        .orderBy(desc(inboxMessages.createdAt))
        .limit(limit);
      return rows.map((r) => ({ id: r.id, title: r.title, body: r.body, createdAt: r.createdAt.getTime(), read: r.readAt !== null }));
    },
    async unread(userId) {
      const [r] = await db
        .select({ n: sql<number>`count(*)` })
        .from(inboxMessages)
        .innerJoin(adminMessages, eq(adminMessages.id, inboxMessages.messageId))
        .where(and(eq(inboxMessages.userId, userId), isNull(inboxMessages.readAt), isNull(adminMessages.retractedAt)));
      return Number(r?.n ?? 0);
    },
    async markRead(userId, inboxId, now) {
      const [r] = await db.select({ id: inboxMessages.id }).from(inboxMessages).where(and(eq(inboxMessages.id, inboxId), eq(inboxMessages.userId, userId)));
      if (!r) return false;
      await db.update(inboxMessages).set({ readAt: new Date(now) }).where(and(eq(inboxMessages.id, inboxId), isNull(inboxMessages.readAt)));
      return true;
    },
    async markAllRead(userId, now) {
      await db.update(inboxMessages).set({ readAt: new Date(now) }).where(and(eq(inboxMessages.userId, userId), isNull(inboxMessages.readAt)));
    },
  };
}

export function createMemoryMessageStore(seed: { users: string[]; baleLinked?: string[] }): MessageStore {
  const messages: SentMessage[] = [];
  const inboxRows: { id: string; userId: string; messageId: string; createdAt: number; readAt: number | null }[] = [];
  const live = (messageId: string) => !messages.find((m) => m.id === messageId)?.retracted;
  return {
    async audienceUsers(audience, userId) {
      if (audience === 'user') return userId && seed.users.includes(userId) ? [userId] : [];
      return audience === 'bale_linked' ? [...(seed.baleLinked ?? [])] : [...seed.users];
    },
    async create(msg) {
      const id = uuidv7();
      messages.push({ ...msg, id, sentAt: Date.now(), retracted: false, channels: [] });
      return id;
    },
    async setChannel(messageId, channel, recipients) {
      messages.find((m) => m.id === messageId)?.channels.push({ channel, recipients });
    },
    async deliverInbox(messageId, userIds) {
      for (const userId of userIds) inboxRows.push({ id: uuidv7(), userId, messageId, createdAt: Date.now(), readAt: null });
    },
    async list(limit) {
      return [...messages].reverse().slice(0, limit);
    },
    async recipients(messageId, limit) {
      return inboxRows
        .filter((r) => r.messageId === messageId)
        .slice(0, limit)
        .map((r) => ({ userId: r.userId, nickname: null, read: r.readAt !== null }));
    },
    async retract(messageId) {
      const m = messages.find((x) => x.id === messageId);
      if (!m || m.retracted) return false;
      m.retracted = true;
      return true;
    },
    async inbox(userId, limit) {
      return inboxRows
        .filter((r) => r.userId === userId && live(r.messageId))
        .reverse()
        .slice(0, limit)
        .map((r) => {
          const m = messages.find((x) => x.id === r.messageId)!;
          return { id: r.id, title: m.title, body: m.body, createdAt: r.createdAt, read: r.readAt !== null };
        });
    },
    async unread(userId) {
      return inboxRows.filter((r) => r.userId === userId && r.readAt === null && live(r.messageId)).length;
    },
    async markRead(userId, inboxId, now) {
      const r = inboxRows.find((x) => x.id === inboxId && x.userId === userId);
      if (!r) return false;
      r.readAt ??= now;
      return true;
    },
    async markAllRead(userId, now) {
      for (const r of inboxRows) if (r.userId === userId) r.readAt ??= now;
    },
  };
}
