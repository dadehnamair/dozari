import { randomInt } from 'node:crypto';
import type { PuzzleAdmin } from '../puzzles/admin.js';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { can } from './accounts/permissions.js';
import { z } from 'zod';
import { accentColorSchema, checkLevelTable, KEEPSAKE_RARITIES, KEEPSAKE_REWARD_GEMS, httpsUrlSchema, isDateKey, ITEMS, ITEM_GROUPS, LEVEL_TABLE_MAX, levelRowSchema, normalizeIranPhone, PRODUCT_CATEGORIES, PROVINCES, provinceOf, SETTING_GROUPS, SHOP_EFFECTS, SPONSOR_LIMITS, COSMETIC_SLOTS, WHEEL_PRIZE_KINDS } from '@dozari/shared';
import type { LevelRow } from '@dozari/shared';
import type { LevelTable } from '../progress/table.js';
import type { SettingsService } from '../settings/service.js';
import { BOT_ADAPTER_KEYS, SOURCE_TYPES } from '../bot/constants.js';
import type { BotRepository } from '../bot/repository.js';
import type { BotService } from '../bot/service.js';
import type { AuditLog } from './audit.js';
import type { LessonStore } from '../lessons/service.js';
import type { EconomyAdmin } from './economy.js';
import type { AgeTrackAdmin } from '../agetrack/overview.js';
import type { ProductAdmin } from './products.js';
import type { StatsAdmin } from './stats.js';
import { isHttpUrl } from '../security/url-guard.js';
import type { MessageCenter } from '../messages/service.js';
import { SMS_PROVIDERS, renderSmsText } from '../phone/smsConfig.js';
import type { SmsGateway } from '../phone/smsConfig.js';
import { SMS_PURPOSES } from '../phone/sms.js';
import type { NotifyService } from '../notify/service.js';
import type { NotifyStore } from '../notify/store.js';
import type { TextFilterService } from '../textfilter/service.js';
import type { UsersAdmin } from './users.js';
import type { PlayerStore } from '../player/store.js';
import type { CoinPackageService } from '../economy/coin-packages.js';
import type { KeepsakeStore } from '../keepsakes/store.js';
import type { ShopStore } from '../economy/shop-store.js';
import type { WheelService } from '../wheel/service.js';
import type { ImageStore } from '@dozari/db';
import { registerAdminUploadRoutes } from './uploads.js';
import { registerLandingAdminRoutes } from '../landing/routes.js';
import type { LandingService } from '../landing/service.js';
import { registerShortLinkAdminRoutes } from '../shortlinks/routes.js';
import { registerFeedbackAdminRoutes } from '../feedback/routes.js';
import { registerClientErrorAdminRoutes } from '../clienterrors/routes.js';
import type { ClientErrorStore } from '../clienterrors/store.js';
import type { FeedbackService } from '../feedback/service.js';
import type { ShortLinkService } from '../shortlinks/service.js';
import type { BadgeService } from '../badges/service.js';
import type { BadgeStore } from '../badges/store.js';
import type { ChatStore } from '../chat/store.js';
import type { TournamentService } from '../tournament/service.js';
import type { SponsorStore } from '../sponsor/store.js';
import type { DailyService } from '../daily/service.js';
import { THEME_KINDS } from '../daily/store.js';
import type { BotPlayerService } from '../botplayers/service.js';
import { registerInviteAdminRoutes } from '../invite/routes.js';
import { registerAiAdminRoutes } from '../ai/routes.js';
import type { AiStudio } from '../ai/studio.js';
import type { AiScheduler } from '../ai/schedules.js';
import type { InviteStore } from '../invite/store.js';
import { registerBackupAdminRoutes } from '../backup/routes.js';
import type { BackupService } from '../backup/service.js';

export interface AdminModules {
  /** Database backups to S3-compatible storage (owner only). */
  backups?: BackupService;
  /** Where the panel's image uploads go (S3 or the local images dir); without it the upload button answers 404. */
  images?: ImageStore;
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
  /** Keepsakes («یادگار») and their sets: `/admin/keepsakes`, `/admin/keepsake-sets`. */
  keepsakes?: KeepsakeStore;
  /** Blog, cast and FAQ of the landing site. */
  landing?: LandingService;
  /** User reports and the suggestion queue. */
  feedback?: FeedbackService;
  clientErrors?: ClientErrorStore;
  /** AI content studio: generates product, kid-lesson, puzzle-title and blog drafts through a chat provider. */
  ai?: AiStudio;
  /** Cron schedules for the AI studio (needs `ai`). */
  aiSchedules?: AiScheduler;
  /** Self-hosted short links (the short domain). */
  shortLinks?: { service: ShortLinkService; base: () => Promise<string> };
  /** Lucky-wheel prize table (kind, amount, odds, visibility). */
  wheel?: WheelService;
  /** Coin packages sold for real money (catalog only; buying is gated by a feature flag). */
  coinPackages?: CoinPackageService;
  /** Invite codes: list, special campaign codes, limits. */
  invites?: InviteStore;
  /** Badge catalog, grants, warnings, commendations, mutes. */
  badges?: { store: BadgeStore; service: BadgeService };
  /** Canned taunts and their categories, chat reports and removing messages. */
  chat?: ChatStore;
  /** Tournament builder and management. */
  tournaments?: TournamentService;
  /** Sponsors shown on tournaments. */
  sponsors?: SponsorStore;
  /** Kid word lessons: the editor list, save text, approve (D198). */
  lessons?: LessonStore;
  /** Numbers per age track for the admin overview tab (D198). */
  ageTracks?: AgeTrackAdmin;
  /** Coin flow and circulation numbers («سلامت اقتصاد»). */
  economy?: EconomyAdmin;
  daily?: DailyService;
  /** The level table: XP each level starts at and the coin reward for reaching it. */
  levelRoad?: { table: LevelTable; defaults: () => Promise<LevelRow[]> };
  /** Hand-built puzzles: readiness of the catalog, list, create (4 groups × 4 products), retire. */
  puzzles?: PuzzleAdmin;
  /** Bot players: generate many natural accounts, tune or pause them. */
  botPlayers?: { service: BotPlayerService; cities: () => Promise<string[]> };
  messages?: MessageCenter;
  /** SMS provider, message texts and a test send. */
  sms?: SmsGateway;
  bale?: { service: NotifyService; store: NotifyStore; botUsername: string | null };
  bot?: { repo: BotRepository; service: BotService };
}

const wordBody = z.object({ word: z.string().trim().min(2).max(100), severity: z.enum(['block', 'mask']).default('block'), track: z.enum(['all', 'kid_teen']).default('all') });
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
    ageTrack: z.enum(['kid', 'teen', 'adult']),
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
  ageTrack: z.enum(['kid', 'teen', 'adult']).optional(),
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
    iconGroups: ITEM_GROUPS,
    modules: { puzzles: !!m.puzzles, settings: !!m.settings, products: !!m.products, stats: !!m.stats, users: !!m.users, bot: !!m.bot, audit: !!m.audit, words: !!m.words, cities: !!m.cities, shop: !!m.shop, keepsakes: !!m.keepsakes, wheel: !!m.wheel, shortLinks: !!m.shortLinks, backups: !!m.backups, feedback: !!m.feedback, clientErrors: !!m.clientErrors, landing: !!m.landing, coinPackages: !!m.coinPackages, invites: !!m.invites, badges: !!m.badges, chat: !!m.chat, tournaments: !!m.tournaments, daily: !!m.daily, lessons: !!m.lessons, ai: !!m.ai, ageTracks: !!m.ageTracks, economy: !!m.economy, levelRoad: !!m.levelRoad, botPlayers: !!m.botPlayers, bale: !!m.bale, messages: !!m.messages, sms: !!m.sms },
  }));

  if (m.ai) registerAiAdminRoutes(g, m.ai, audit, m.aiSchedules);

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
        .object({ q: z.string().max(60).default(''), filter: z.enum(['all', 'banned', 'new']).default('all'), sort: z.enum(['lastSeen', 'created', 'coins']).default('lastSeen'), track: z.enum(['kid', 'teen', 'adult']).optional(), offset: z.coerce.number().int().min(0).max(100_000).default(0) })
        .safeParse(req.query);
      if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' });
      const q = parsed.data;
      return { users: await users.list(q.q, 50, { filter: q.filter, sort: q.sort, offset: q.offset, ...(q.track ? { track: q.track } : {}), contact: !!req.adminActor && can(req.adminActor.role, 'users') }) };
    });
    g.get('/admin/users/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      const detail = await users.detail(p.data.id);
      if (!detail) return reply.code(404).send({ error: 'user_not_found' });
      // Privacy (profile-and-identity.md): age for everyone with access, the exact birth date for the owner only.
      const role = req.adminActor?.role;
      const out = role === 'owner' ? detail : { ...detail, birth: null };
      // Contact details (phone, e-mail, device id) are for roles that manage players; viewers and editors get them blanked.
      return role && can(role, 'users') ? out : { ...out, account: { ...out.account, phone: null, email: null, deviceId: null } };
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
    g.post('/admin/users/:id/gems', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object({ delta: z.number().int().min(-10_000).max(10_000).refine((n) => n !== 0) }).safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await users.adjustGems(p.data.id, b.data.delta);
      if (out === 'not_found') return reply.code(404).send({ error: 'user_not_found' });
      if (out === 'insufficient') return reply.code(409).send({ error: 'insufficient' });
      void audit('user.gems', p.data.id, String(b.data.delta));
      return { ok: true, balance: out.balance };
    });
  }

  if (m.messages) {
    const center = m.messages;
    const sendBody = z
      .object({
        title: z.string().trim().min(1).max(150),
        body: z.string().trim().min(1).max(2000),
        audience: z.enum(['all', 'bale_linked', 'user', 'kid', 'teen']),
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
    g.get('/admin/messages/:id/recipients', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      return { recipients: await center.recipients(p.data.id) };
    });
    g.delete('/admin/messages/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      if (!(await center.retract(p.data.id))) return reply.code(404).send({ error: 'message_not_found' });
      void audit('message.retract', p.data.id);
      return { ok: true };
    });
  }

  if (m.sms) {
    const sms = m.sms;
    const purpose = z.enum(SMS_PURPOSES);
    const secret = z.string().trim().max(200).regex(/^[\x21-\x7e]*$/); // printable ASCII, no spaces
    const configBody = z.object({ provider: z.enum(SMS_PROVIDERS).optional(), irnotiKey: secret.optional(), kavenegarKey: secret.optional(), kavenegarTemplate: z.string().trim().max(100).regex(/^[\w.-]*$/).optional() });
    const testSends: number[] = []; // a real SMS costs money: 5 test sends a minute for the whole panel
    g.get('/admin/sms', async () => sms.adminState());
    g.put('/admin/sms', async (req, reply) => {
      const b = configBody.safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      await sms.update(b.data);
      void audit('sms.config', b.data.provider ?? '-', ['irnotiKey', 'kavenegarKey', 'kavenegarTemplate'].filter((k) => k in b.data).join(','));
      return sms.adminState();
    });
    g.put('/admin/sms/texts/:purpose', async (req, reply) => {
      const p = purpose.safeParse((req.params as { purpose?: string }).purpose);
      const b = z.object({ text: z.string().max(300) }).safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      if (!(await sms.setText(p.data, b.data.text.trim()))) return reply.code(400).send({ error: 'text_needs_code' });
      void audit('sms.text', p.data, b.data.text.slice(0, 100));
      return sms.adminState();
    });
    g.post('/admin/sms/test', async (req, reply) => {
      const b = z.object({ phone: z.string().min(10).max(20), purpose }).safeParse(req.body);
      const phone = b.success ? normalizeIranPhone(b.data.phone) : null;
      if (!b.success || !phone) return reply.code(400).send({ error: 'invalid_phone' });
      const state = await sms.adminState();
      if (!state.active) return reply.code(409).send({ error: 'sms_unavailable' });
      const now = Date.now();
      while (testSends.length && now - testSends[0]! > 60_000) testSends.shift();
      if (testSends.length >= 5) return reply.code(429).send({ error: 'rate_limited' });
      testSends.push(now);
      const code = '12345';
      try {
        await sms.sendCode(phone, code, b.data.purpose);
      } catch (e) {
        void audit('sms.test_failed', b.data.purpose, phone.slice(0, 6));
        return reply.code(502).send({ error: 'send_failed', detail: e instanceof Error ? e.message : String(e) });
      }
      void audit('sms.test', b.data.purpose, `${state.active} ${phone.slice(0, 6)}`);
      return { ok: true, provider: state.active, text: state.active === 'irnoti' ? renderSmsText(await sms.textFor(b.data.purpose), code) : null };
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
      const out = await words.add(b.data.word, b.data.severity, b.data.track);
      if (out === 'duplicate') return reply.code(409).send({ error: 'duplicate' });
      void audit('word.add', out.id, `${b.data.severity}/${b.data.track}`);
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
    /** A `PROVINCES` key, or null for no regional identity. */
    const provinceKey = z.string().refine((k) => provinceOf(k) !== null).nullable();
    g.get('/admin/cities', async () => {
      const [list, stats] = await Promise.all([cities.cities({ includeHidden: true }), cities.cityStats()]);
      const none = { players: 0, active7d: 0, bots: 0, xp: 0 };
      return { cities: list.map((c) => ({ ...c, stats: stats.get(c.id) ?? none })), provinces: PROVINCES.map((p) => ({ key: p.key, nameFa: p.nameFa, abroad: p.abroad, giftFa: p.giftFa })) };
    });
    g.get('/admin/cities/:id/players', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const q = z.object({ q: z.string().max(60).default(''), offset: z.coerce.number().int().min(0).max(100_000).default(0) }).safeParse(req.query);
      if (!p.success || !q.success) return reply.code(400).send({ error: 'invalid_request' });
      if (!(await cities.city(p.data.id))) return reply.code(404).send({ error: 'city_not_found' });
      return { players: await cities.cityPlayers(p.data.id, { q: q.data.q, limit: 50, offset: q.data.offset }) };
    });
    /** Moves a player to another city, or out of any city (`cityId: null`). */
    g.put('/admin/cities/:id/players/:userId', async (req, reply) => {
      const p = z.object({ id: z.string().uuid(), userId: z.string().uuid() }).safeParse(req.params);
      const b = z.object({ cityId: z.string().uuid().nullable() }).safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      if (b.data.cityId && !(await cities.city(b.data.cityId))) return reply.code(404).send({ error: 'city_not_found' });
      if ((await cities.privateRow(p.data.userId)).cityId !== p.data.id) return reply.code(404).send({ error: 'user_not_found' });
      await cities.setCity(p.data.userId, b.data.cityId);
      void audit('city.player_move', p.data.userId, b.data.cityId ?? 'none');
      return { ok: true };
    });
    g.post('/admin/cities', async (req, reply) => {
      const b = z.object({ slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/), nameFa: z.string().trim().min(2).max(60), province: provinceKey.optional() }).safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await cities.addCity(b.data.slug, b.data.nameFa, b.data.province ?? null);
      if (out === 'duplicate') return reply.code(409).send({ error: 'duplicate' });
      void audit('city.add', out.id, b.data.nameFa);
      return reply.code(201).send({ id: out.id });
    });
    g.patch('/admin/cities/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object({ nameFa: z.string().trim().min(2).max(60).optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().min(0).max(10000).optional(), province: provinceKey.optional(), souvenirFa: z.string().trim().max(60).transform((v) => v || null).nullable().optional(), sloganFa: z.string().trim().max(120).optional() }).safeParse(req.body);
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
      const b = z.object({ nameFa: z.string().trim().min(2).max(40), cityId: z.string().uuid().nullable().optional(), ageTrack: z.enum(['kid', 'teen', 'adult']).optional() }).safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const c = await chat.addCategory(b.data.nameFa, b.data.cityId ?? null, b.data.ageTrack ?? 'adult');
      void audit('taunt_category.add', c.id, b.data.nameFa);
      return reply.code(201).send({ id: c.id });
    });
    g.patch('/admin/taunt-categories/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object({ nameFa: z.string().trim().min(2).max(40).optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().min(0).max(1000).optional(), cityId: z.string().uuid().nullable().optional(), ageTrack: z.enum(['kid', 'teen', 'adult']).optional() }).safeParse(req.body);
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
    // `?queue=minors` is the separate kid/teen review queue (docs/logic/age-tracks.md §Admin panel); `adults` the rest; default everything.
    // Only moderating roles (players or messages) read the lines of kid/teen chats; a viewer gets the adult queue whatever was asked.
    g.get('/admin/chat/reports', async (req) => {
      const q = z.object({ queue: z.enum(['all', 'minors', 'adults']).default('all') }).safeParse(req.query);
      const role = req.adminActor?.role;
      const moderates = !!role && (can(role, 'users') || can(role, 'messages'));
      return { reports: await chat.reports({ openOnly: false, limit: 100, queue: moderates && q.success ? q.data.queue : 'adults' }), minorsQueue: moderates };
    });
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
      entryGems: z.number().int().min(0).max(1_000).default(0),
      minLevel: z.number().int().min(1).max(500),
      startsAt: z.number().int(),
      botFill: z.boolean().optional(),
      allowConcurrent: z.boolean().optional(),
      sponsorId: z.string().uuid().nullable().optional(),
      prizes: z.array(z.object({ place: z.number().int().min(1).max(3), coins: z.number().int().min(0).max(1_000_000), gems: z.number().int().min(0).max(500).default(0), spins: z.number().int().min(0).max(20).default(0) })).max(3),
    };
    const fail = (reply: FastifyReply, error: string, reason?: string) => reply.code(error === 'NOT_FOUND' ? 404 : error === 'BAD_STATE' ? 409 : 400).send({ error, ...(reason ? { reason } : {}) });
    g.get('/admin/tournaments', async () => ({ tournaments: await tournaments.adminList() }));
    g.post('/admin/tournaments', async (req, reply) => {
      const b = z.object({ ...fields, publish: z.boolean().default(false) }).safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const { publish, ...input } = b.data;
      const out = await tournaments.create(input, publish);
      if (!out.ok) return fail(reply, out.error, out.reason);
      void audit('tournament.create', out.id, `${input.titleFa} size=${input.size} fee=${input.entryCoins}`);
      return reply.code(201).send({ id: out.id });
    });
    g.patch('/admin/tournaments/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object(fields).partial().safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await tournaments.update(p.data.id, b.data);
      if (!out.ok) return fail(reply, out.error, out.reason);
      void audit('tournament.update', p.data.id, JSON.stringify(b.data).slice(0, 200));
      return { ok: true };
    });
    for (const [action, run] of [['publish', (id: string) => tournaments.publish(id)], ['start', (id: string) => tournaments.startNow(id)], ['cancel', (id: string) => tournaments.cancel(id)]] as const) {
      g.post(`/admin/tournaments/:id/${action}`, async (req, reply) => {
        const p = idParam.safeParse(req.params);
        if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
        const out = await run(p.data.id);
        if (!out.ok) return fail(reply, out.error, out.reason);
        void audit(`tournament.${action}`, p.data.id);
        return { ok: true, ...('refunded' in out ? { refunded: out.refunded } : {}) };
      });
    }
  }

  if (m.economy) {
    const economy = m.economy;
    g.get('/admin/economy', async (req) => {
      const q = z.object({ days: z.coerce.number().int().min(1).max(90).default(7) }).safeParse(req.query);
      return economy.overview(q.success ? q.data.days : 7, Date.now());
    });
  }

  if (m.ageTracks) {
    const tracks = m.ageTracks;
    g.get('/admin/age-tracks', async () => tracks.overview());
    // Guardians: who holds which children, with support actions (all audited). The number is contact data: only roles that manage players see it.
    g.get('/admin/guardians', async (req) => {
      const q = z.object({ q: z.string().max(40).default('') }).safeParse(req.query);
      const rows = await tracks.guardians(q.success ? q.data.q : '', 100);
      const contact = !!req.adminActor && can(req.adminActor.role, 'users');
      return { guardians: rows.map((r) => (contact ? r : { ...r, phone: null })) };
    });
    g.post('/admin/guardians/children/:id/unlink', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      if (!(await tracks.unlink(p.data.id))) return reply.code(404).send({ error: 'not_linked' });
      void audit('guardian.unlink', p.data.id);
      return { ok: true };
    });
    g.put('/admin/guardians/children/:id/track', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object({ track: z.enum(['kid', 'teen']) }).safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      if (!(await tracks.setChildTrack(p.data.id, b.data.track))) return reply.code(404).send({ error: 'not_linked' });
      void audit('guardian.child_track', p.data.id, b.data.track);
      return { ok: true };
    });
  }

  if (m.lessons) {
    const lessons = m.lessons;
    const productParam = z.object({ productId: z.string().min(1).max(36) });
    const lessonBody = z.object({ wordFa: z.string().trim().min(1).max(60), storyFa: z.string().trim().max(300).default(''), syllablesFa: z.string().trim().max(80).nullable().default(null) });
    g.get('/admin/lessons', async (req) => {
      const q = z.object({ status: z.enum(['draft', 'approved', 'missing']).optional() }).safeParse(req.query);
      return { items: await lessons.listKidItems(q.success ? q.data.status : undefined) };
    });
    g.put('/admin/lessons/:productId', async (req, reply) => {
      const p = productParam.safeParse(req.params);
      const b = lessonBody.safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      if (!(await lessons.save(p.data.productId, { ...b.data, syllablesFa: b.data.syllablesFa || null }))) return reply.code(404).send({ error: 'NOT_FOUND' });
      void audit('lesson.save', p.data.productId, b.data.wordFa);
      return { ok: true };
    });
    for (const [action, status] of [['approve', 'approved'], ['unapprove', 'draft']] as const) {
      g.post(`/admin/lessons/:productId/${action}`, async (req, reply) => {
        const p = productParam.safeParse(req.params);
        if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
        if ((await lessons.setStatus(p.data.productId, status, null)) === 'not_found') return reply.code(404).send({ error: 'NOT_FOUND' });
        void audit(`lesson.${action}`, p.data.productId);
        return { ok: true };
      });
    }
  }

  if (m.sponsors) {
    const sponsors = m.sponsors;
    const body = z.object({
      nameFa: z.string().trim().min(2).max(SPONSOR_LIMITS.name),
      taglineFa: z.string().trim().max(SPONSOR_LIMITS.tagline).default(''),
      descriptionFa: z.string().trim().max(SPONSOR_LIMITS.description).default(''),
      bannerUrl: httpsUrlSchema.nullable().default(null),
      logoUrl: httpsUrlSchema.nullable().default(null),
      linkUrl: httpsUrlSchema.nullable().default(null),
      accent: accentColorSchema.nullable().default(null),
      isActive: z.boolean().default(true),
    });
    g.get('/admin/sponsors', async () => ({ sponsors: await sponsors.list() }));
    g.post('/admin/sponsors', async (req, reply) => {
      const b = body.safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const row = await sponsors.create(b.data);
      void audit('sponsor.create', row.id, row.nameFa);
      return reply.code(201).send({ id: row.id });
    });
    g.patch('/admin/sponsors/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = body.partial().safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      if ((await sponsors.update(p.data.id, b.data)) === 'not_found') return reply.code(404).send({ error: 'NOT_FOUND' });
      void audit('sponsor.update', p.data.id, JSON.stringify(b.data).slice(0, 200));
      return { ok: true };
    });
  }

  if (m.puzzles) {
    const puzzles = m.puzzles;
    const groupBody = z.object({ level: z.number().int().min(0).max(3), titleFa: z.string().trim().min(2).max(100), explanationFa: z.string().trim().max(300).optional(), productIds: z.array(z.string().uuid()).length(4) });
    g.get('/admin/puzzles', async () => ({ readiness: await puzzles.readiness(), puzzles: await puzzles.list(200), tiers: await puzzles.tiers() }));
    g.post('/admin/puzzles', async (req, reply) => {
      const b = z.object({ groups: z.array(groupBody).length(4), tierId: z.string().uuid().nullable().optional(), ageTrack: z.enum(['kid', 'teen', 'adult']).optional() }).safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      // The explanation is optional in the form: it falls back to the title.
      const out = await puzzles.create(b.data.groups.map((x) => ({ ...x, explanationFa: x.explanationFa && x.explanationFa.length >= 2 ? x.explanationFa : x.titleFa })), b.data.tierId, b.data.ageTrack);
      if (!out.ok) return reply.code(out.error === 'unknown_product' ? 404 : 400).send({ error: out.error });
      void audit('puzzle.create', out.id);
      return reply.code(201).send({ id: out.id });
    });
    g.post('/admin/puzzles/generate', async (req, reply) => {
      const b = z.object({ count: z.number().int().min(1).max(20), tierId: z.string().uuid().optional() }).safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      if (b.data.tierId && !(await puzzles.tiers()).some((t) => t.id === b.data.tierId)) return reply.code(404).send({ error: 'unknown_tier' });
      const out = await puzzles.generate(b.data.count, () => randomInt(0, 2 ** 30) / 2 ** 30, { tierId: b.data.tierId });
      void audit('puzzle.generate', 'puzzles', `${out.created}/${out.requested}`);
      return out;
    });
    // Difficulty tiers: the ladder the admin defines, and which puzzle sits on which rung (docs/logic/progression.md §Puzzle tiers).
    const tierBody = z.object({ id: z.string().uuid().optional(), nameFa: z.string().trim().min(1).max(40), sortOrder: z.number().int().min(0).max(1000), minLevel: z.number().int().min(1).max(1000), maxLevel: z.number().int().min(1).max(1000).nullable() });
    g.get('/admin/puzzles/tiers', async () => ({ tiers: await puzzles.tiers() }));
    g.post('/admin/puzzles/tiers', async (req, reply) => {
      const b = tierBody.safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await puzzles.saveTier(b.data);
      if (!out.ok) return reply.code(out.error === 'not_found' ? 404 : 400).send({ error: out.error });
      void audit('puzzle.tier.save', out.id, b.data.nameFa);
      return { id: out.id };
    });
    g.delete('/admin/puzzles/tiers/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await puzzles.deleteTier(p.data.id);
      if (out === 'not_found') return reply.code(404).send({ error: out });
      void audit('puzzle.tier.delete', p.data.id);
      return { ok: true };
    });
    g.put('/admin/puzzles/:id/tier', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object({ tierId: z.string().uuid().nullable() }).safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await puzzles.setTier(p.data.id, b.data.tierId);
      if (out !== 'ok') return reply.code(404).send({ error: out });
      void audit('puzzle.tier', p.data.id, b.data.tierId ?? '-');
      return { ok: true };
    });
    g.put('/admin/puzzles/:id/titles', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object({ titles: z.array(z.object({ level: z.number().int().min(0).max(3), titleFa: z.string().trim().min(2).max(100) })).min(1).max(4) }).safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await puzzles.setTitles(p.data.id, b.data.titles);
      if (out === 'not_found') return reply.code(404).send({ error: out });
      void audit('puzzle.titles', p.data.id);
      return { ok: true };
    });
    g.patch('/admin/puzzles/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object({ status: z.enum(['approved', 'retired']) }).safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      const out = await puzzles.setStatus(p.data.id, b.data.status);
      if (out === 'not_found') return reply.code(404).send({ error: out });
      void audit('puzzle.status', p.data.id, b.data.status);
      return { ok: true };
    });
  }

  if (m.levelRoad) {
    const { table, defaults } = m.levelRoad;
    g.get('/admin/level-road', async (req) => {
      const rows = await table.get();
      // `?defaults=1` = what the settings' formulas give, for «fill from formula» in the editor.
      if ((req.query as { defaults?: string }).defaults === '1') return { custom: rows !== null, rows: await defaults() };
      return { custom: rows !== null, rows: rows ?? (await defaults()) };
    });
    g.put('/admin/level-road', async (req, reply) => {
      const b = z.object({ rows: z.array(levelRowSchema).min(1).max(LEVEL_TABLE_MAX) }).safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const problem = checkLevelTable(b.data.rows);
      if (problem) return reply.code(400).send({ error: problem });
      await table.set(b.data.rows);
      void audit('level_road.save', String(b.data.rows.length), `${b.data.rows.reduce((n, r) => n + r.rewardCoins, 0)} coins`);
      return { custom: true, rows: b.data.rows };
    });
    // Back to the formulas of the settings (curve, level cap, every-Nth-level coins).
    g.delete('/admin/level-road', async () => {
      await table.reset();
      void audit('level_road.reset', '');
      return { custom: false, rows: await defaults() };
    });
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
      slot: z.enum(COSMETIC_SLOTS).nullable().default(null),
      amount: z.number().int().min(1).max(1000),
      currency: z.enum(['coins', 'gems']),
      priceCoins: z.number().int().min(0).max(1_000_000),
      priceGems: z.number().int().min(0).max(100_000),
      /** Real-money price in rials (0 = not sold for money). */
      priceRials: z.number().int().min(0).max(1_000_000_000).default(0),
      skuBazaar: z.string().trim().max(80).nullable().default(null),
      skuMyket: z.string().trim().max(80).nullable().default(null),
      minLevel: z.number().int().min(1).max(500),
      perDayLimit: z.number().int().min(0).max(1000),
      iconKey: z.string().max(30).nullable(),
      isActive: z.boolean(),
      /** In the daily rotating pool (`shop.daily_slots` of the rotating items are on offer each day). */
      rotating: z.boolean().default(false),
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

  if (m.keepsakes) {
    const ks = m.keepsakes;
    const defFields = {
      productId: z.string().uuid().nullable().default(null),
      titleFa: z.string().trim().min(2).max(120),
      storyFa: z.string().trim().min(2).max(2000),
      eraYear: z.number().int().min(1300).max(1500).nullable().default(null),
      rarity: z.enum(KEEPSAKE_RARITIES),
      pieces: z.number().int().min(1).max(12).default(4),
      /** Key of the art supplied by the designer; null = placeholder frame. */
      artKey: z.string().trim().max(60).nullable().default(null),
      setId: z.string().uuid().nullable().default(null),
      rewardGems: z.number().int().min(0).max(1000).default(KEEPSAKE_REWARD_GEMS),
      isActive: z.boolean().default(true),
    };
    const setFields = { titleFa: z.string().trim().min(2).max(120), rewardGems: z.number().int().min(0).max(10_000).default(10), isActive: z.boolean().default(true) };
    g.get('/admin/keepsakes', async () => ({ defs: await ks.defs({ includeHidden: true }), sets: await ks.sets({ includeHidden: true }) }));
    g.post('/admin/keepsakes', async (req, reply) => {
      const b = z.object(defFields).safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const row = await ks.addDef(b.data);
      void audit('keepsake.add', row.id, b.data.titleFa);
      return reply.code(201).send({ id: row.id });
    });
    g.patch('/admin/keepsakes/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object(defFields).partial().safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      if ((await ks.updateDef(p.data.id, b.data)) === 'not_found') return reply.code(404).send({ error: 'keepsake_not_found' });
      void audit('keepsake.update', p.data.id, JSON.stringify(b.data));
      return { ok: true };
    });
    g.post('/admin/keepsake-sets', async (req, reply) => {
      const b = z.object(setFields).safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const row = await ks.addSet(b.data);
      void audit('keepsake.set.add', row.id, b.data.titleFa);
      return reply.code(201).send({ id: row.id });
    });
    g.patch('/admin/keepsake-sets/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object(setFields).partial().safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      if ((await ks.updateSet(p.data.id, b.data)) === 'not_found') return reply.code(404).send({ error: 'set_not_found' });
      void audit('keepsake.set.update', p.data.id, JSON.stringify(b.data));
      return { ok: true };
    });
  }

  if (m.images) registerAdminUploadRoutes(g, m.images, (a, t, d) => void audit(a, t, d));
  if (m.landing) registerLandingAdminRoutes(g, m.landing, (a, t, d) => void audit(a, t, d));
  if (m.feedback) registerFeedbackAdminRoutes(g, m.feedback, (a, t, d) => void audit(a, t, d));
  if (m.backups) registerBackupAdminRoutes(g, m.backups, (a, t, d) => void audit(a, t, d));
  if (m.clientErrors) registerClientErrorAdminRoutes(g, m.clientErrors, (a, t, d) => void audit(a, t, d));
  if (m.shortLinks) registerShortLinkAdminRoutes(g, m.shortLinks.service, m.shortLinks.base, (a, t, d) => void audit(a, t, d));

  if (m.wheel) {
    const wheel = m.wheel;
    const prizeFields = {
      kind: z.enum(WHEEL_PRIZE_KINDS),
      amount: z.number().int().min(1).max(100_000),
      /** The shop item a `cosmetic` slice gives. */
      itemId: z.string().uuid().nullable().default(null),
      weight: z.number().int().min(0).max(1000),
      isActive: z.boolean(),
    };
    g.get('/admin/wheel/prizes', async () => ({ prizes: await wheel.prizes.list() }));
    g.post('/admin/wheel/prizes', async (req, reply) => {
      const b = z.object(prizeFields).safeParse(req.body);
      if (!b.success || (b.data.kind === 'cosmetic' && !b.data.itemId)) return reply.code(400).send({ error: 'invalid_request' });
      const row = await wheel.prizes.add(b.data);
      void audit('wheel.add', row.id, `${b.data.kind} ${b.data.amount} w${b.data.weight}`);
      return reply.code(201).send({ id: row.id });
    });
    g.patch('/admin/wheel/prizes/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object(prizeFields).partial().safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      if ((await wheel.prizes.update(p.data.id, b.data)) === 'not_found') return reply.code(404).send({ error: 'prize_not_found' });
      void audit('wheel.update', p.data.id, JSON.stringify(b.data));
      return { ok: true };
    });
  }

  if (m.coinPackages) {
    const cp = m.coinPackages.admin;
    const fields = {
      titleFa: z.string().trim().min(2).max(80),
      coins: z.number().int().min(1).max(10_000_000),
      priceRials: z.number().int().min(0).max(1_000_000_000_000).transform((n) => BigInt(n)),
      skuBazaar: z.string().trim().max(80).nullable(),
      skuMyket: z.string().trim().max(80).nullable(),
      minLevel: z.number().int().min(1).max(500),
      isActive: z.boolean(),
    };
    g.get('/admin/coin-packages', async () => ({ packages: (await cp.list()).map((p) => ({ ...p, priceRials: Number(p.priceRials) })) }));
    g.post('/admin/coin-packages', async (req, reply) => {
      const b = z.object(fields).safeParse(req.body);
      if (!b.success) return reply.code(400).send({ error: 'invalid_request' });
      const row = await cp.add(b.data);
      void audit('coin_package.add', row.id, `${b.data.titleFa} ${b.data.coins}`);
      return reply.code(201).send({ id: row.id });
    });
    g.patch('/admin/coin-packages/:id', async (req, reply) => {
      const p = idParam.safeParse(req.params);
      const b = z.object(fields).partial().safeParse(req.body);
      if (!p.success || !b.success) return reply.code(400).send({ error: 'invalid_request' });
      if ((await cp.update(p.data.id, b.data)) === 'not_found') return reply.code(404).send({ error: 'package_not_found' });
      void audit('coin_package.update', p.data.id, JSON.stringify(b.data, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)));
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
