import { and, asc, badges, chatMutes, desc, eq, gte, modActions, sql, userBadges, userNotices, users } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';

export type BadgeKind = 'badge' | 'medal';
export type BadgePerk = 'none' | 'share_contact' | 'moderator';
export type RuleMetric = 'none' | 'games' | 'wins' | 'level';
export type NoticeKind = 'warning' | 'commendation';
export type IssuerType = 'admin' | 'agent';

export interface BadgeRow {
  id: string;
  slug: string;
  titleFa: string;
  descriptionFa: string;
  kind: BadgeKind;
  iconKey: string | null;
  perk: BadgePerk;
  ruleMetric: RuleMetric;
  ruleMin: number;
  isActive: boolean;
  sortOrder: number;
}
export type NewBadge = Omit<BadgeRow, 'id' | 'sortOrder'>;

export interface NoticeRow {
  id: string;
  userId: string;
  kind: NoticeKind;
  text: string;
  issuerType: IssuerType;
  issuerId: string | null;
  createdAt: number;
  readAt: number | null;
}

export interface MuteRow {
  until: number;
  reason: string;
}

/** I/O boundary of badges, medals, notices, mutes and agent actions. */
export interface BadgeStore {
  catalog(opts?: { includeHidden?: boolean }): Promise<BadgeRow[]>;
  addBadge(b: NewBadge): Promise<BadgeRow | 'duplicate'>;
  updateBadge(id: string, patch: Partial<NewBadge> & { sortOrder?: number }): Promise<'ok' | 'not_found'>;
  earned(userId: string): Promise<{ badgeId: string; awardedAt: number }[]>;
  /** True when this is a new award. */
  award(userId: string, badgeId: string, by: string | null): Promise<boolean>;
  revoke(userId: string, badgeId: string): Promise<boolean>;
  equippedId(userId: string): Promise<string | null>;
  equip(userId: string, badgeId: string | null): Promise<void>;
  addNotice(n: { userId: string; kind: NoticeKind; text: string; issuerType: IssuerType; issuerId: string | null }): Promise<NoticeRow>;
  notices(userId: string, limit: number): Promise<NoticeRow[]>;
  markNoticesRead(userId: string): Promise<void>;
  setMute(userId: string, until: number, reason: string, issuerType: IssuerType, issuerId: string | null): Promise<void>;
  activeMute(userId: string, nowMs: number): Promise<MuteRow | null>;
  clearMute(userId: string): Promise<void>;
  logAction(agentId: string, targetId: string, action: 'warn' | 'mute', nowMs: number): Promise<void>;
  actionsSince(agentId: string, sinceMs: number): Promise<number>;
}

/** Starting catalog: a contact-sharing badge earned by level, the moderator role granted by an admin, and three medals. */
export const DEFAULT_BADGES: readonly NewBadge[] = [
  { slug: 'share_contact', titleFa: 'نشان تماس', descriptionFa: 'اجازه‌ی فرستادن شماره، ID و لینک در چت. با رسیدن به سطح ۱۰ به دست می‌آید.', kind: 'badge', iconKey: 'envelope', perk: 'share_contact', ruleMetric: 'level', ruleMin: 10, isActive: true },
  { slug: 'agent', titleFa: 'آجان دوزاری', descriptionFa: 'نگهبان چت: می‌تواند اخطار بدهد و کوتاه‌مدت سکوت بدهد. فقط ادمین می‌دهد.', kind: 'badge', iconKey: 'flag', perk: 'moderator', ruleMetric: 'none', ruleMin: 0, isActive: true },
  { slug: 'first_game', titleFa: 'اولین قدم', descriptionFa: 'اولین بازی را تمام کردی.', kind: 'medal', iconKey: 'star', perk: 'none', ruleMetric: 'games', ruleMin: 1, isActive: true },
  { slug: 'veteran', titleFa: 'کهنه‌کار', descriptionFa: 'پنجاه بازی را تمام کردی.', kind: 'medal', iconKey: 'medal', perk: 'none', ruleMetric: 'games', ruleMin: 50, isActive: true },
  { slug: 'winner', titleFa: 'برنده', descriptionFa: 'بیست بازی را بردی.', kind: 'medal', iconKey: 'trophy', perk: 'none', ruleMetric: 'wins', ruleMin: 20, isActive: true },
];

export function createDbBadgeStore(db: Db): BadgeStore {
  let seeded = false;
  const seed = async () => {
    if (seeded) return;
    const [any] = await db.select({ id: badges.id }).from(badges).limit(1);
    if (!any) {
      for (const [i, b] of DEFAULT_BADGES.entries()) await db.insert(badges).values({ ...b, id: uuidv7(), sortOrder: i }).onDuplicateKeyUpdate({ set: { slug: sql`${badges.slug}` } });
    }
    seeded = true;
  };
  const toNotice = (r: typeof userNotices.$inferSelect): NoticeRow => ({ id: r.id, userId: r.userId, kind: r.kind, text: r.text, issuerType: r.issuerType, issuerId: r.issuerId, createdAt: r.createdAt.getTime(), readAt: r.readAt ? r.readAt.getTime() : null });
  return {
    async catalog(opts) {
      await seed();
      return db.select().from(badges).where(opts?.includeHidden ? undefined : eq(badges.isActive, true)).orderBy(asc(badges.sortOrder));
    },
    async addBadge(b) {
      await seed();
      const [dup] = await db.select({ id: badges.id }).from(badges).where(eq(badges.slug, b.slug));
      if (dup) return 'duplicate';
      const [agg] = await db.select({ top: sql<number>`COALESCE(MAX(${badges.sortOrder}), 0)` }).from(badges);
      const row = { ...b, id: uuidv7(), sortOrder: Number(agg?.top ?? 0) + 1 };
      await db.insert(badges).values(row);
      return row;
    },
    async updateBadge(id, patch) {
      const [r] = await db.select({ id: badges.id }).from(badges).where(eq(badges.id, id));
      if (!r) return 'not_found';
      await db.update(badges).set(patch).where(eq(badges.id, id));
      return 'ok';
    },
    async earned(userId) {
      const rows = await db.select().from(userBadges).where(eq(userBadges.userId, userId));
      return rows.map((r) => ({ badgeId: r.badgeId, awardedAt: r.awardedAt.getTime() }));
    },
    async award(userId, badgeId, by) {
      const [have] = await db.select({ b: userBadges.badgeId }).from(userBadges).where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badgeId)));
      if (have) return false;
      try {
        await db.insert(userBadges).values({ userId, badgeId, awardedBy: by });
        return true;
      } catch {
        return false;
      }
    },
    async revoke(userId, badgeId) {
      const [have] = await db.select({ b: userBadges.badgeId }).from(userBadges).where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badgeId)));
      if (!have) return false;
      await db.delete(userBadges).where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badgeId)));
      await db.update(users).set({ equippedBadgeId: null }).where(and(eq(users.id, userId), eq(users.equippedBadgeId, badgeId)));
      return true;
    },
    async equippedId(userId) {
      const [r] = await db.select({ b: users.equippedBadgeId }).from(users).where(eq(users.id, userId));
      return r?.b ?? null;
    },
    async equip(userId, badgeId) {
      await db.update(users).set({ equippedBadgeId: badgeId }).where(eq(users.id, userId));
    },
    async addNotice(n) {
      const id = uuidv7();
      await db.insert(userNotices).values({ id, ...n });
      const [r] = await db.select().from(userNotices).where(eq(userNotices.id, id));
      return toNotice(r!);
    },
    async notices(userId, limit) {
      return (await db.select().from(userNotices).where(eq(userNotices.userId, userId)).orderBy(desc(userNotices.createdAt)).limit(limit)).map(toNotice);
    },
    async markNoticesRead(userId) {
      await db.update(userNotices).set({ readAt: new Date() }).where(and(eq(userNotices.userId, userId), sql`${userNotices.readAt} IS NULL`));
    },
    async setMute(userId, until, reason, issuerType, issuerId) {
      const v = { userId, until: new Date(until), reason, issuerType, issuerId };
      await db.insert(chatMutes).values(v).onDuplicateKeyUpdate({ set: v });
    },
    async activeMute(userId, nowMs) {
      const [r] = await db.select().from(chatMutes).where(eq(chatMutes.userId, userId));
      return r && r.until.getTime() > nowMs ? { until: r.until.getTime(), reason: r.reason } : null;
    },
    async clearMute(userId) {
      await db.delete(chatMutes).where(eq(chatMutes.userId, userId));
    },
    async logAction(agentId, targetId, action, nowMs) {
      await db.insert(modActions).values({ id: uuidv7(), agentId, targetId, action, createdAt: new Date(nowMs) });
    },
    async actionsSince(agentId, sinceMs) {
      const rows = await db.select({ id: modActions.id }).from(modActions).where(and(eq(modActions.agentId, agentId), gte(modActions.createdAt, new Date(sinceMs))));
      return rows.length;
    },
  };
}


export function createMemoryBadgeStore(seedBadges: readonly NewBadge[] = DEFAULT_BADGES): BadgeStore {
  const rows: BadgeRow[] = seedBadges.map((b, i) => ({ ...b, id: `00000000-0000-7000-8000-${String(i + 1).padStart(12, '0')}`, sortOrder: i }));
  const owned = new Map<string, Map<string, number>>();
  const equipped = new Map<string, string>();
  const notices: NoticeRow[] = [];
  const mutes = new Map<string, MuteRow>();
  const actions: { agentId: string; at: number }[] = [];
  let seq = 0;
  return {
    async catalog(opts) {
      return rows.filter((r) => opts?.includeHidden || r.isActive).map((r) => ({ ...r }));
    },
    async addBadge(b) {
      if (rows.some((r) => r.slug === b.slug)) return 'duplicate';
      const row = { ...b, id: `00000000-0000-7000-8000-${String(rows.length + 1).padStart(12, '0')}`, sortOrder: rows.length };
      rows.push(row);
      return { ...row };
    },
    async updateBadge(id, patch) {
      const r = rows.find((x) => x.id === id);
      if (!r) return 'not_found';
      Object.assign(r, patch);
      return 'ok';
    },
    async earned(u) {
      return [...(owned.get(u) ?? new Map())].map(([badgeId, awardedAt]) => ({ badgeId, awardedAt }));
    },
    async award(u, b) {
      const m = owned.get(u) ?? new Map<string, number>();
      owned.set(u, m);
      if (m.has(b)) return false;
      m.set(b, Date.now());
      return true;
    },
    async revoke(u, b) {
      const had = owned.get(u)?.delete(b) ?? false;
      if (equipped.get(u) === b) equipped.delete(u);
      return had;
    },
    async equippedId(u) {
      return equipped.get(u) ?? null;
    },
    async equip(u, b) {
      if (b === null) equipped.delete(u);
      else equipped.set(u, b);
    },
    async addNotice(n) {
      const row: NoticeRow = { ...n, id: `00000000-0000-7000-9000-${String(++seq).padStart(12, '0')}`, createdAt: Date.now() + seq, readAt: null };
      notices.push(row);
      return { ...row };
    },
    async notices(u, limit) {
      return notices.filter((n) => n.userId === u).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit).map((n) => ({ ...n }));
    },
    async markNoticesRead(u) {
      for (const n of notices) if (n.userId === u && n.readAt === null) n.readAt = Date.now();
    },
    async setMute(u, until, reason) {
      mutes.set(u, { until, reason });
    },
    async activeMute(u, now) {
      const m = mutes.get(u);
      return m && m.until > now ? { ...m } : null;
    },
    async clearMute(u) {
      mutes.delete(u);
    },
    async logAction(agentId, _t, _a, now) {
      actions.push({ agentId, at: now });
    },
    async actionsSince(agentId, since) {
      return actions.filter((a) => a.agentId === agentId && a.at >= since).length;
    },
  };
}
