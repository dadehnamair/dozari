import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { isDateKey, ITEMS, PRODUCT_CATEGORIES, SETTING_GROUPS, SHOP_EFFECTS } from '@dozari/shared';
import type { SettingsService } from '../settings/service.js';
import { BOT_ADAPTER_KEYS, SOURCE_TYPES } from '../bot/constants.js';
import type { BotRepository } from '../bot/repository.js';
import type { BotService } from '../bot/service.js';
import type { AuditLog } from './audit.js';
import type { ProductAdmin } from './products.js';
import type { StatsAdmin } from './stats.js';
import { isHttpUrl } from '../security/url-guard.js';
import type { MessageCenter } from '../messages/service.js';
import type { NotifyService } from '../notify/service.js';
import type { NotifyStore } from '../notify/store.js';
import type { TextFilterService } from '../textfilter/service.js';
import type { UsersAdmin } from './users.js';
import type { PlayerStore } from '../player/store.js';
import type { ShopStore } from '../economy/shop-store.js';
import type { BadgeService } from '../badges/service.js';
import type { BadgeStore } from '../badges/store.js';
import type { ChatStore } from '../chat/store.js';
import type { TournamentService } from '../tournament/service.js';
import type { DailyService } from '../daily/service.js';
import { THEME_KINDS } from '../daily/store.js';
import type { BotPlayerService } from '../botplayers/service.js';
import { registerInviteAdminRoutes } from '../invite/routes.js';
import type { InviteStore } from '../invite/store.js';

export interface AdminModules {
  settings?: SettingsService;
  products?: ProductAdmin;
  stats?: StatsAdmin;
  users?: UsersAdmin;
  audit?: AuditLog;
  words?: TextFilterService;
  /** Cities players can pick (list, add, rename, hide). */
  cities?: PlayerStore;
  /** Coin shop items (price, level gate, daily limit, visibility). */
  shop?: ShopStore;
  /** Invite codes: list, special campaign codes, limits. */
  invites?: InviteStore;
  /** Badge catalog, grants, warnings, commendations, mutes. */
  badges?: { store: BadgeStore; service: BadgeService };
  /** Canned taunts and their categories, chat reports and removing messages. */
  chat?: ChatStore;
  /** Tournament builder and management. */
  tournaments?: TournamentService;
  daily?: DailyService;
  /** Bot players: generate many natural accounts, tune or pause them. */
  botPlayers?: { service: BotPlayerService; cities: () => Promise<string[]> };
  messages?: MessageCenter;
  bale?: { service: NotifyService; store: NotifyStore; botUsername: string | null };
  bot?: { repo: BotRepository; service: BotService };
}

const wordBody = z.object({ word: z.string().trim().min(2).max(100), severity: z.enum(['block', 'mask']).default('block') });
const httpUrl = z.string().max(1000).refine(isHttpUrl, 'http(s) only');
const idParam = z.object({ id: z.string().uuid() });
const rials = z.string().regex(/^\d{1,15}$/);
const year = z.number().int().min(1300).max(1450);

const productPatch = z
  .object({
    nameFa: z.string().trim().min(1).max(200),
    unitFa: z.string().trim().max(100).nullable(),
    brand: z.string().trim().max(200).nullable(),
    category: z.enum(PRODUCT_CATEGORIES),
    storyFa: z.string().max(4000).nullable(),
    iconKey: z.string().max(40).nullable(),
    isActive: z.boolean(),
    status: z.enum(['in_production', 'discontinued', 'changed']),
  })
  .partial()
  .strict();

const newProduct = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,98}$/),
  nameFa: z.string().trim().min(1).max(200),
  category: z.enum(PRODUCT_CATEGORIES),
  unitFa: z.string().trim().max(100).nullable().optional(),
  iconKey: z.string().max(40).nullable().optional(),
});

const newPrice = z.object({
  productId: z.string().uuid(),
  year,
  month: z.number().int().min(1).max(12).nullable().default(null),
  priceRials: rials,
  sourceType: z.enum(SOURCE_TYPES),
  sourceUrl: httpUrl.nullable().optional(),
  sourceNote: z.string().max(2000).nullable().optional(),
  confidence: z.number().int().min(1).max(3).default(2),
});

const sourceBody = z.object({
  name: z.string().trim().min(1).max(150),
  url: httpUrl,
  adapter: z.enum(BOT_ADAPTER_KEYS),
  sourceType: z.enum(SOURCE_TYPES).default('website'),
  enabled: z.boolean().default(true),
  everyHours: z.number().int().min(1).max(720).default(24),
  notes: z.string().max(2000).nullable().optional(),
  options: z.record(z.string().max(60), z.string().max(500)).default({}),
});

const approveBody = z.object({
  productId: z.string().uuid().optional(),
  create: newProduct.optional(),
});

/** Everything the admin panel can do beyond the original catalog review; each module is optional. */
export function registerAdminModules(g: FastifyInstance, m: AdminModules) {
  const audit = (action: string, target: string, detail?: string) => m.audit?.record(action, target, detail);

  g.get('/admin/meta', async () => ({
    categories: PRODUCT_CATEGORIES,
    sourceTypes: SOURCE_TYPES,
    adapters: BOT_ADAPTER_KEYS,
    settingGroups: SETTING_GROUPS,
    icons: ITEMS,
    modules: { settings: !!m.settings, products: !!m.products, stats: !!m.stats, users: !!m.users, bot: !!m.bot, audit: !!m.audit, words: !!m.words, cities: !!m.cities, shop: !!m.shop, invites: !!m.invites, badges: !!m.badges, chat: !!m.chat, tournaments: !!m.tournaments, daily: !!m.daily, botPlayers: !!m.botPlayers, bale: !!m.bale, messages: !!m.messages },
  }));

  if (m.stats) {
    const stats = m.stats;
    g.get('/admin/dashboard', async () => stats.dashboard(Date.now()));
  }

  if (m.audit) {
    const log = m.audit;
    g.get('/admin/audit', async () => ({ entries: await log.recent(100) }));
  }

  if (m.settings) {
    const settings = m.settings;
    g.get('/admin/settings', async () => ({ settings: await settings.rows() }));
    g.put('/admin/settings/:key', async (req, reply) => {
      const key = (req.params as { key?: string }).key ?? '';
      const body = z.object({ value: z.union([z.string().max(400), z.number()]) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await settings.set(key, String(body.data.value));
      if (out !== 'ok') return reply.code(out === 'invalid_key' ? 404 : 400).send({ error: out });
      void audit('settings.set', key, String(body.data.value));
      return { ok: true, settings: await settings.rows() };
    });
    g.delete('/admin/settings/:key', async (req, reply) => {
      const key = (req.params as { key?: string }).key ?? '';
      if ((await settings.reset(key)) !== 'ok') return reply.code(404).send({ error: 'invalid_key' });
      void audit('settings.reset', key);
      return { ok: true, settings: await settings.rows() };
    });
  }

  if (m.products) {
    const products = m.products;
    g.patch('/admin/products/:id', async (req, reply) => {
      const params = idParam.safeParse(req.params);
      const body = productPatch.safeParse(req.body);
      if (!params.success || !body.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await products.update(params.data.id, body.data);
      if (out === 'not_found') return reply.code(404).send({ error: 'product_not_found' });
      if (out === 'invalid') return reply.code(400).send({ error: 'invalid_request' });
      void audit('product.update', params.data.id, JSON.stringify(body.data));
      return { ok: true };
    });
    g.post('/admin/products', async (req, reply) => {
      const body = newProduct.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await products.create(body.data);
      if (out === 'duplicate') return reply.code(409).send({ error: 'slug_taken' });
      if (out === 'invalid') return reply.code(400).send({ error: 'invalid_request' });
      void audit('product.create', out.id, body.data.slug);
      return reply.code(201).send(out);
    });
    g.post('/admin/prices', async (req, reply) => {
      const body = newPrice.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await products.addPrice({ ...body.data, priceRials: BigInt(body.data.priceRials) });
      if (out === 'not_found') return reply.code(404).send({ error: 'product_not_found' });
      if (out === 'duplicate') return reply.code(409).send({ error: 'price_exists' });
      void audit('price.add', out.id, `${body.data.productId} ${body.data.year}`);
      return reply.code(201).send(out);
    });
  }

  if (m.users) {
    const users = m.users;
    g.get('/admin/users', async (req, reply) => {
      const parsed = z
        .object({ q: z.string().max(60).default(''), filter: z.enum(['all', 'banned', 'new']).default('all'), sort: z.enum(['lastSeen', 'created', 'coins']).default('lastSeen'), offset: z.coerce.number().int().min(0).max(100_000).default(0) })
        .safeParse(req.query);
      if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' });
      const q = parsed.data;
      return { users: await users.list(q.q, 50, { filter: q.filter, sort: q.sort, offset: q.offset }) };
    });
    g.get('/admin/users/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      return (await users.detail(p.data.id)) ?? reply.code(404).send({ error: 'user_not_found' });
    });
    g.get('/admin/users/:id/ledger', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      return { entries: await users.ledger(p.data.id, 50) };
    });
    g.post('/admin/users/:id/ban', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object({ banned: z.boolean(), reason: z.string().trim().max(200).nullable().optional() }).safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      if ((await users.setBanned(p.data.id, b.data.banned, b.data.reason)) === 'not_found') return reply.code(404).send({ error: 'user_not_found' });
      void audit(b.data.banned ? 'user.ban' : 'user.unban', p.data.id, b.data.reason ?? undefined);
      return { ok: true };
    });
    g.post('/admin/users/:id/logout', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      if ((await users.logoutEverywhere(p.data.id)) === 'not_found') return reply.code(404).send({ error: 'user_not_found' });
      void audit('user.logout', p.data.id);
      return { ok: true };
    });
    g.put('/admin/users/:id/identity', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object({ nickname: z.string().trim().min(2).max(30).optional(), avatarKey: z.string().max(30).optional() }).safeParse(req.body ?? {});
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      const identity = b.data.nickname !== undefined || b.data.avatarKey !== undefined ? b.data : undefined;
      const out = await users.setIdentity(p.data.id, identity);
      if (out === 'not_found') return reply.code(404).send({ error: 'user_not_found' });
      if (out === 'invalid') return reply.code(400).send({ error: 'invalid_request' });
      void audit(identity ? 'user.identity' : 'user.identity_reset', p.data.id, identity?.nickname);
      return { ok: true };
    });
    g.post('/admin/users/:id/notes', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object({ note: z.string().trim().min(1).max(500) }).safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await users.addNote(p.data.id, b.data.note);
      if (out === 'not_found') return reply.code(404).send({ error: 'user_not_found' });
      void audit('user.note', p.data.id);
      return reply.code(201).send(out);
    });
    g.delete('/admin/user-notes/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      if ((await users.removeNote(p.data.id)) === 'not_found') return reply.code(404).send({ error: 'note_not_found' });
      void audit('user.note_delete', p.data.id);
      return { ok: true };
    });
    g.post('/admin/users/:id/coins', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object({ delta: z.number().int().min(-100_000).max(100_000).refine((n) => n !== 0) }).safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await users.adjustCoins(p.data.id, b.data.delta);
      if (out === 'not_found') return reply.code(404).send({ error: 'user_not_found' });
      if (out === 'insufficient') return reply.code(409).send({ error: 'insufficient' });
      void audit('user.coins', p.data.id, String(b.data.delta));
      return { ok: true, balance: out.balance };
    });
  }

  if (m.messages) {
    const center = m.messages;
    const sendBody = z
      .object({
        title: z.string().trim().min(1).max(150),
        body: z.string().trim().min(1).max(2000),
        audience: z.enum(['all', 'bale_linked', 'user']),
        targetUserId: z.string().uuid().nullable().default(null),
        channels: z.array(z.enum(['in_app', 'bale', 'sms', 'email', 'push'])).min(1).max(5),
      })
      .refine((b) => (b.audience === 'user') === (b.targetUserId !== null), { message: 'targetUserId' });
    g.get('/admin/messages/channels', async () => ({ channels: center.channels() }));
    g.get('/admin/messages', async () => ({ messages: await center.history() }));
    g.post('/admin/messages', async (req, reply) => {
      const b = sendBody.safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await center.send({ title: b.data.title, body: b.data.body, audience: b.data.audience, targetUserId: b.data.targetUserId }, b.data.channels);
      if (!out.ok) return reply.code(out.error === 'NO_RECIPIENTS' ? 409 : 400).send({ error: out.error.toLowerCase() });
      void audit('message.send', out.id, `${b.data.audience} ${b.data.channels.join(',')} ${b.data.title.slice(0, 60)}`);
      return reply.code(201).send({ id: out.id, recipients: out.recipients });
    });
    g.delete('/admin/messages/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      if (!(await center.retract(p.data.id))) return reply.code(404).send({ error: 'message_not_found' });
      void audit('message.retract', p.data.id);
      return { ok: true };
    });
  }

  if (m.bale) {
    const { service, store, botUsername } = m.bale;
    const textBody = z.object({ text: z.string().trim().min(1).max(1000) });
    g.get('/admin/bale', async () => ({ configured: service.configured, botUsername, linked: await store.linkedCount(), outbox: await store.stats() }));
    g.post('/admin/bale/broadcast', async (req, reply) => {
      const b = textBody.safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const queued = await service.broadcast(b.data.text);
      void audit('bale.broadcast', String(queued), b.data.text.slice(0, 100));
      return { queued };
    });
    g.post('/admin/bale/test', async (req, reply) => {
      const b = z.object({ chatId: z.string().regex(/^-?\d{3,20}$/), text: z.string().trim().min(1).max(500).default('پیام آزمایشی دوزاری ✅') }).safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      await service.notifyChat(b.data.chatId, 'test', b.data.text);
      void audit('bale.test', b.data.chatId);
      return { queued: 1 };
    });
  }

  if (m.words) {
    const words = m.words;
    g.get('/admin/words', async () => ({ words: await words.list() }));
    g.post('/admin/words', async (req, reply) => {
      const b = wordBody.safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await words.add(b.data.word, b.data.severity);
      if (out === 'duplicate') return reply.code(409).send({ error: 'duplicate' });
      void audit('word.add', out.id, b.data.severity);
      return reply.code(201).send({ id: out.id });
    });
    g.patch('/admin/words/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object({ severity: z.enum(['block', 'mask']) }).safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      if ((await words.setSeverity(p.data.id, b.data.severity)) === 'not_found') return reply.code(404).send({ error: 'word_not_found' });
      void audit('word.severity', p.data.id, b.data.severity);
      return { ok: true };
    });
    g.delete('/admin/words/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      if ((await words.remove(p.data.id)) === 'not_found') return reply.code(404).send({ error: 'word_not_found' });
      void audit('word.remove', p.data.id);
      return { ok: true };
    });
    /** Dry run for the admin: what the filter would do with this text. Never stored. */
    g.post('/admin/words/test', async (req, reply) => {
      const b = z.object({ text: z.string().max(500) }).safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      return words.check(b.data.text);
    });
  }

  if (m.cities) {
    const cities = m.cities;
    g.get('/admin/cities', async () => ({ cities: await cities.cities({ includeHidden: true }) }));
    g.post('/admin/cities', async (req, reply) => {
      const b = z.object({ slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/), nameFa: z.string().trim().min(2).max(60) }).safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await cities.addCity(b.data.slug, b.data.nameFa);
      if (out === 'duplicate') return reply.code(409).send({ error: 'duplicate' });
      void audit('city.add', out.id, b.data.nameFa);
      return reply.code(201).send({ id: out.id });
    });
    g.patch('/admin/cities/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object({ nameFa: z.string().trim().min(2).max(60).optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().min(0).max(10000).optional() }).safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      if ((await cities.updateCity(p.data.id, b.data)) === 'not_found') return reply.code(404).send({ error: 'city_not_found' });
      void audit('city.update', p.data.id, JSON.stringify(b.data));
      return { ok: true };
    });
  }

  if (m.badges) {
    const { store, service } = m.badges;
    const badgeFields = {
      titleFa: z.string().trim().min(2).max(60),
      descriptionFa: z.string().trim().max(200),
      kind: z.enum(['badge', 'medal']),
      iconKey: z.string().max(30).nullable(),
      perk: z.enum(['none', 'share_contact', 'moderator']),
      ruleMetric: z.enum(['none', 'games', 'wins', 'level']),
      ruleMin: z.number().int().min(0).max(1_000_000),
      isActive: z.boolean(),
    };
    g.get('/admin/badges', async () => ({ badges: await store.catalog({ includeHidden: true }) }));
    g.post('/admin/badges', async (req, reply) => {
      const b = z.object({ slug: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{2,40}$/), ...badgeFields }).safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await store.addBadge(b.data);
      if (out === 'duplicate') return reply.code(409).send({ error: 'duplicate' });
      void audit('badge.add', out.id, b.data.titleFa);
      return reply.code(201).send({ id: out.id });
    });
    g.patch('/admin/badges/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object(badgeFields).partial().safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      if ((await store.updateBadge(p.data.id, b.data)) === 'not_found') return reply.code(404).send({ error: 'badge_not_found' });
      void audit('badge.update', p.data.id, JSON.stringify(b.data));
      return { ok: true };
    });
    g.get('/admin/users/:id/badges', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      return service.me(p.data.id);
    });
    g.post('/admin/users/:id/badges', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object({ badgeId: z.string().uuid() }).safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      if (!(await service.grant(p.data.id, b.data.badgeId, 'admin'))) return reply.code(404).send({ error: 'badge_not_found' });
      void audit('badge.grant', p.data.id, b.data.badgeId);
      return { ok: true };
    });
    g.delete('/admin/users/:id/badges/:badgeId', async (req, reply) => {
      const p = z.object({ id: z.string().uuid(), badgeId: z.string().uuid() }).safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      if (!(await service.revoke(p.data.id, p.data.badgeId))) return reply.code(404).send({ error: 'not_found' });
      void audit('badge.revoke', p.data.id, p.data.badgeId);
      return { ok: true };
    });
    g.post('/admin/users/:id/notices', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object({ kind: z.enum(['warning', 'commendation']), text: z.string().trim().min(3).max(300) }).safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      await service.issueNotice(p.data.id, b.data.kind, b.data.text, { type: 'admin', id: null });
      void audit(`notice.${b.data.kind}`, p.data.id, b.data.text.slice(0, 100));
      return reply.code(201).send({ ok: true });
    });
    g.post('/admin/users/:id/mute', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object({ minutes: z.number().int().min(1).max(60 * 24 * 365), reason: z.string().trim().max(200) }).safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      await service.adminMute(p.data.id, b.data.minutes, b.data.reason);
      void audit('user.mute', p.data.id, `${b.data.minutes}m ${b.data.reason}`);
      return { ok: true };
    });
    g.delete('/admin/users/:id/mute', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      await service.clearMute(p.data.id);
      void audit('user.unmute', p.data.id);
      return { ok: true };
    });
  }

  if (m.chat) {
    const chat = m.chat;
    g.get('/admin/taunts', async () => ({ categories: await chat.taunts({ includeHidden: true }) }));
    g.post('/admin/taunt-categories', async (req, reply) => {
      const b = z.object({ nameFa: z.string().trim().min(2).max(40), cityId: z.string().uuid().nullable().optional() }).safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const c = await chat.addCategory(b.data.nameFa, b.data.cityId ?? null);
      void audit('taunt_category.add', c.id, b.data.nameFa);
      return reply.code(201).send({ id: c.id });
    });
    g.patch('/admin/taunt-categories/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object({ nameFa: z.string().trim().min(2).max(40).optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().min(0).max(1000).optional(), cityId: z.string().uuid().nullable().optional() }).safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      if ((await chat.updateCategory(p.data.id, b.data)) === 'not_found') return reply.code(404).send({ error: 'category_not_found' });
      void audit('taunt_category.update', p.data.id, JSON.stringify(b.data));
      return { ok: true };
    });
    g.post('/admin/taunts', async (req, reply) => {
      const b = z.object({ categoryId: z.string().uuid(), text: z.string().trim().min(2).max(120) }).safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const t = await chat.addTaunt(b.data.categoryId, b.data.text);
      if (t === 'no_category') return reply.code(404).send({ error: 'category_not_found' });
      void audit('taunt.add', t.id, b.data.text);
      return reply.code(201).send({ id: t.id });
    });
    g.patch('/admin/taunts/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object({ text: z.string().trim().min(2).max(120).optional(), isActive: z.boolean().optional(), categoryId: z.string().uuid().optional(), sortOrder: z.number().int().min(0).max(1000).optional() }).safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      if ((await chat.updateTaunt(p.data.id, b.data)) === 'not_found') return reply.code(404).send({ error: 'taunt_not_found' });
      void audit('taunt.update', p.data.id, JSON.stringify(b.data));
      return { ok: true };
    });
    g.get('/admin/chat/reports', async () => ({ reports: await chat.reports({ openOnly: false, limit: 100 }) }));
    g.post('/admin/chat/reports/:id/resolve', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      if (!(await chat.resolveReport(p.data.id))) return reply.code(404).send({ error: 'report_not_found' });
      void audit('chat_report.resolve', p.data.id);
      return { ok: true };
    });
    g.delete('/admin/chat/messages/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      if (!(await chat.removeMessage(p.data.id))) return reply.code(404).send({ error: 'message_not_found' });
      void audit('chat_message.remove', p.data.id);
      return { ok: true };
    });
  }

  if (m.tournaments) {
    const tournaments = m.tournaments;
    const fields = {
      titleFa: z.string().trim().min(2).max(80),
      descriptionFa: z.string().trim().max(4000),
      iconKey: z.string().max(30).nullable(),
      size: z.number().int(),
      minPlayers: z.number().int().min(2).max(32),
      entryCoins: z.number().int().min(0).max(100_000),
      minLevel: z.number().int().min(1).max(500),
      startsAt: z.number().int(),
      botFill: z.boolean().optional(),
      prizes: z.array(z.object({ place: z.number().int().min(1).max(3), coins: z.number().int().min(0).max(1_000_000) })).max(3),
    };
    const fail = (reply: FastifyReply, error: string) => reply.code(error === 'NOT_FOUND' ? 404 : error === 'BAD_STATE' ? 409 : 400).send({ error });
    g.get('/admin/tournaments', async () => ({ tournaments: await tournaments.adminList() }));
    g.post('/admin/tournaments', async (req, reply) => {
      const b = z.object({ ...fields, publish: z.boolean().default(false) }).safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const { publish, ...input } = b.data;
      const out = await tournaments.create(input, publish);
      if (!out.ok) return fail(reply, out.error);
      void audit('tournament.create', out.id, `${input.titleFa} size=${input.size} fee=${input.entryCoins}`);
      return reply.code(201).send({ id: out.id });
    });
    g.patch('/admin/tournaments/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object(fields).partial().safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await tournaments.update(p.data.id, b.data);
      if (!out.ok) return fail(reply, out.error);
      void audit('tournament.update', p.data.id, JSON.stringify(b.data).slice(0, 200));
      return { ok: true };
    });
    for (const [action, run] of [['publish', (id: string) => tournaments.publish(id)], ['start', (id: string) => tournaments.startNow(id)], ['cancel', (id: string) => tournaments.cancel(id)]] as const) {
      g.post(`/admin/tournaments/:id/${action}`, async (req, reply) => {
        const p = idParam.safeParse(req.params);
        if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
        const out = await run(p.data.id);
        if (!out.ok) return fail(reply, out.error);
        void audit(`tournament.${action}`, p.data.id);
        return { ok: true, ...('refunded' in out ? { refunded: out.refunded } : {}) };
      });
    }
  }

  if (m.daily) {
    const daily = m.daily;
    const month = z.number().int().min(1).max(12);
    const day = z.number().int().min(1).max(31);
    const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    const themeBody = z
      .object({
        titleFa: z.string().trim().min(2).max(80),
        kind: z.enum(THEME_KINDS),
        weight: z.number().int().min(1).max(100),
        startMonth: month.nullable(),
        startDay: day.nullable(),
        endMonth: month.nullable(),
        endDay: day.nullable(),
        fromDate: dateStr.nullable(),
        toDate: dateStr.nullable(),
        isActive: z.boolean(),
      })
      .refine((t) => [t.startMonth, t.startDay, t.endMonth, t.endDay].every((v) => v === null) || [t.startMonth, t.startDay, t.endMonth, t.endDay].every((v) => v !== null), 'recurring window must be complete')
      .refine((t) => (!t.fromDate || isDateKey(t.fromDate)) && (!t.toDate || isDateKey(t.toDate)), 'bad date');
    g.get('/admin/daily-puzzle/themes', async () => ({ themes: await daily.adminThemes() }));
    g.get('/admin/daily-puzzle/puzzles', async () => ({ puzzles: await daily.puzzles(300) }));
    g.post('/admin/daily-puzzle/themes', async (req, reply) => {
      const b = themeBody.safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await daily.saveTheme(null, b.data);
      void audit('daily_theme.create', out?.id ?? '', b.data.titleFa);
      return { ok: true, theme: out };
    });
    g.patch('/admin/daily-puzzle/themes/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = themeBody.safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await daily.saveTheme(p.data.id, b.data);
      if (!out) return reply.code(404).send({ error: 'not_found' });
      void audit('daily_theme.update', p.data.id, b.data.titleFa);
      return { ok: true };
    });
    g.delete('/admin/daily-puzzle/themes/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      if (!(await daily.deleteTheme(p.data.id))) return reply.code(404).send({ error: 'not_found' });
      void audit('daily_theme.delete', p.data.id);
      return { ok: true };
    });
    g.get('/admin/daily-puzzle/themes/:id/puzzles', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      return { puzzleIds: await daily.linked(p.data.id) };
    });
    for (const on of [true, false]) {
      g.route({
        method: on ? 'POST' : 'DELETE',
        url: '/admin/daily-puzzle/themes/:id/puzzles/:puzzleId',
        handler: async (req, reply) => {
          const p = z.object({ id: z.string().uuid(), puzzleId: z.string().uuid() }).safeParse(req.params);
          if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
          if ((await daily.link(p.data.id, p.data.puzzleId, on)) === 'not_found') return reply.code(404).send({ error: 'not_found' });
          void audit(on ? 'daily_theme.link' : 'daily_theme.unlink', p.data.id, p.data.puzzleId);
          return { ok: true };
        },
      });
    }
    g.get('/admin/daily-puzzle/schedule', async (req) => {
      const q = z.object({ days: z.coerce.number().int().min(1).max(60).default(14) }).safeParse(req.query);
      return { days: await daily.schedule(q.success ? q.data.days : 14) };
    });
    g.put('/admin/daily-puzzle/days/:dateKey', async (req, reply) => {
      const p = z.object({ dateKey: dateStr }).safeParse(req.params);
      const b = z.object({ puzzleId: z.string().uuid(), themeId: z.string().uuid().nullable().default(null) }).safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await daily.pin(p.data.dateKey, b.data.puzzleId, b.data.themeId);
      if (out !== 'ok') return reply.code(out === 'played' ? 409 : out === 'not_found' ? 404 : 400).send({ error: out });
      void audit('daily_puzzle.pin', p.data.dateKey, b.data.puzzleId);
      return { ok: true };
    });
    g.delete('/admin/daily-puzzle/days/:dateKey', async (req, reply) => {
      const p = z.object({ dateKey: dateStr }).safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      if ((await daily.unpin(p.data.dateKey)) === 'played') return reply.code(409).send({ error: 'played' });
      void audit('daily_puzzle.unpin', p.data.dateKey);
      return { ok: true };
    });
  }

  if (m.botPlayers) {
    const { service, cities } = m.botPlayers;
    g.get('/admin/bots', async () => ({ bots: await service.list() }));
    g.post('/admin/bots/generate', async (req, reply) => {
      const b = z
        .object({
          count: z.number().int().min(1).max(50),
          levelMin: z.number().int().min(1).max(100),
          levelMax: z.number().int().min(1).max(100),
          skillMin: z.number().int().min(0).max(100),
          skillMax: z.number().int().min(0).max(100),
          winPercentMin: z.number().int().min(20).max(85),
          winPercentMax: z.number().int().min(20).max(85),
          thinkMinMs: z.number().int().min(1000).max(60_000),
          thinkMaxMs: z.number().int().min(1000).max(60_000),
          tauntPercent: z.number().int().min(0).max(100),
          withCities: z.boolean().default(true),
        })
        .safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const { withCities, ...opts } = b.data;
      const out = await service.generate({ ...opts, cityIds: withCities ? await cities() : [] });
      void audit('bots.generate', String(out.created.length), JSON.stringify(opts).slice(0, 200));
      return reply.code(201).send({ created: out.created.length });
    });
    g.patch('/admin/bots/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object({ skill: z.number().int().min(0).max(100).optional(), thinkMinMs: z.number().int().min(1000).max(60_000).optional(), thinkMaxMs: z.number().int().min(1000).max(60_000).optional(), tauntPercent: z.number().int().min(0).max(100).optional(), isActive: z.boolean().optional(), cityId: z.string().uuid().nullable().optional() }).safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      if ((await service.update(p.data.id, b.data)) === 'not_found') return reply.code(404).send({ error: 'bot_not_found' });
      void audit('bot.update', p.data.id, JSON.stringify(b.data));
      return { ok: true };
    });
  }

  if (m.invites) registerInviteAdminRoutes(g, m.invites, (a, t, d) => void audit(a, t, d));

  if (m.shop) {
    const shop = m.shop;
    const itemFields = {
      titleFa: z.string().trim().min(2).max(80),
      descriptionFa: z.string().trim().max(300),
      effect: z.enum(SHOP_EFFECTS),
      amount: z.number().int().min(1).max(1000),
      priceCoins: z.number().int().min(0).max(1_000_000),
      minLevel: z.number().int().min(1).max(500),
      perDayLimit: z.number().int().min(0).max(1000),
      iconKey: z.string().max(30).nullable(),
      isActive: z.boolean(),
    };
    g.get('/admin/shop', async () => ({ items: await shop.items({ includeHidden: true }) }));
    g.post('/admin/shop', async (req, reply) => {
      const b = z.object(itemFields).safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const row = await shop.addItem(b.data);
      void audit('shop.add', row.id, `${b.data.titleFa} ${b.data.priceCoins}`);
      return reply.code(201).send({ id: row.id });
    });
    g.patch('/admin/shop/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object(itemFields).partial().safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      if ((await shop.updateItem(p.data.id, b.data)) === 'not_found') return reply.code(404).send({ error: 'item_not_found' });
      void audit('shop.update', p.data.id, JSON.stringify(b.data));
      return { ok: true };
    });
  }

  if (m.bot) {
    const { repo, service } = m.bot;
    const maxPerRun = async () => (m.settings ? m.settings.num('bot.max_candidates_per_run') : 100);
    g.get('/admin/bot/sources', async () => ({ sources: await repo.listSources() }));
    g.post('/admin/bot/sources', async (req, reply) => {
      const b = sourceBody.safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const id = await repo.createSource(b.data);
      void audit('bot.source.create', id, b.data.name);
      return reply.code(201).send({ id });
    });
    g.put('/admin/bot/sources/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = sourceBody.partial().safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      if (!(await repo.updateSource(p.data.id, b.data))) return reply.code(404).send({ error: 'source_not_found' });
      void audit('bot.source.update', p.data.id);
      return { ok: true };
    });
    g.delete('/admin/bot/sources/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      if (!(await repo.deleteSource(p.data.id))) return reply.code(404).send({ error: 'source_not_found' });
      void audit('bot.source.delete', p.data.id);
      return { ok: true };
    });
    g.post('/admin/bot/sources/:id/run', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await service.runOne(p.data.id, await maxPerRun());
      if (!out) return reply.code(404).send({ error: 'source_not_found' });
      void audit('bot.run', p.data.id, `${out.status} found=${out.found} new=${out.added}`);
      return out;
    });
    g.post('/admin/bot/run-due', async () => ({ runs: await service.runDue(await maxPerRun()) }));
    g.get('/admin/bot/runs', async () => ({ runs: await repo.listRuns(50) }));
    g.get('/admin/bot/candidates', async (req) => {
      const q = z.object({ status: z.enum(['pending', 'approved', 'rejected']).default('pending') }).parse(req.query);
      return { candidates: await repo.listCandidates(q.status, 200) };
    });
    g.post('/admin/bot/candidates/:id/approve', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = approveBody.safeParse(req.body ?? {});
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await repo.approve(p.data.id, b.data);
      if (out === 'not_found') return reply.code(404).send({ error: out });
      if (out !== 'ok') return reply.code(out === 'needs_product' ? 400 : 409).send({ error: out });
      void audit('bot.candidate.approve', p.data.id);
      return { ok: true };
    });
    g.post('/admin/bot/candidates/:id/reject', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await repo.reject(p.data.id);
      if (out === 'not_found') return reply.code(404).send({ error: out });
      if (out !== 'ok') return reply.code(409).send({ error: out });
      void audit('bot.candidate.reject', p.data.id);
      return { ok: true };
    });
  }
}
