import { randomInt } from 'node:crypto';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { resolve } from 'node:path';
import { rialsToTomanString } from '@dozari/shared';
import { CHAT_RETENTION_DAYS, TOURNAMENT_TICK_SECONDS } from '@dozari/shared';
import type { HintRules } from '@dozari/shared';
import { createDb } from '@dozari/db';
import { createDbCatalogRepository } from './catalog/db-repository.js';
import { DailyRewardService } from './economy/daily-reward.js';
import { createDbDailyRewardStore } from './economy/daily-reward-db.js';
import { registerDailyRewardRoutes } from './economy/routes.js';
import { AuthService } from './auth/service.js';
import { createDbUserRepository } from './auth/db-repository.js';
import { attachGateway } from './realtime/gateway.js';
import type { Gateway } from './realtime/gateway.js';
import type { MatchDeps } from './realtime/match-service.js';
import { PlayerService, rulesFromSettings } from './player/service.js';
import { createDbPlayerStore } from './player/store.js';
import { registerTransferRoutes } from './transfers/routes.js';
import { TransferService, transferRulesFromSettings } from './transfers/service.js';
import { createDbTransferStore } from './transfers/store.js';
import { registerBadgeRoutes } from './badges/routes.js';
import { BadgeService, modRulesFromSettings, skillRulesFromSettings } from './badges/service.js';
import { createDbBadgeStore } from './badges/store.js';
import { registerChatRoutes } from './chat/routes.js';
import { ChatService, chatRulesFromSettings } from './chat/service.js';
import { createDbChatStore } from './chat/store.js';
import type { MatchService } from './realtime/match-service.js';
import type { DuelQueue } from './realtime/queue.js';
import { registerDailyRoutes } from './daily/routes.js';
import { DailyService } from './daily/service.js';
import { createDbDailyStore } from './daily/store.js';
import { registerTournamentRoutes } from './tournament/routes.js';
import { TournamentService } from './tournament/service.js';
import { createDbTournamentStore } from './tournament/store.js';
import { BotDriver } from './botplayers/driver.js';
import { BotPlayerService } from './botplayers/service.js';
import { createDbBotPlayerStore } from './botplayers/store.js';
import { registerFindRoutes } from './find/routes.js';
import { FindService } from './find/service.js';
import { createShortener } from './find/shortener.js';
import { createDbFindStore } from './find/store.js';
import { registerPhoneRoutes } from './phone/routes.js';
import { PhoneService, phoneRulesFromSettings } from './phone/service.js';
import { createKavenegarClient } from './phone/sms.js';
import { createDbPhoneStore } from './phone/store.js';
import { registerInviteRoutes } from './invite/routes.js';
import { InviteService, inviteRulesFromSettings } from './invite/service.js';
import { createDbInviteStore } from './invite/store.js';
import { createDbProfileLookup } from './realtime/profile.js';
import { registerAuthRoutes } from './auth/routes.js';
import { createTokenSigner } from './auth/tokens.js';
import { createDbAdminRepository } from './admin/db-repository.js';
import { registerAdminRoutes } from './admin/routes.js';
import type { AdminModules } from './admin/module-routes.js';
import { AdminAccounts } from './admin/accounts/service.js';
import { createDbAdminStore } from './admin/accounts/store.js';
import { createDbAuditLog } from './admin/audit.js';
import { createDbProductAdmin } from './admin/products.js';
import { createDbStatsAdmin } from './admin/stats.js';
import { createDbUsersAdmin } from './admin/users.js';
import { createDbBotRepository } from './bot/repository.js';
import { BotService } from './bot/service.js';
import { startBotScheduler } from './bot/scheduler.js';
import { TextFilterService, createDbWordStore } from './textfilter/service.js';
import { createBaleClient } from './notify/client.js';
import { NotifyService } from './notify/service.js';
import { startNotifyRunner } from './notify/runner.js';
import { registerBaleRoutes } from './notify/routes.js';
import { MessageCenter } from './messages/service.js';
import { createDbMessageStore } from './messages/store.js';
import { registerInboxRoutes } from './messages/routes.js';
import { SocialService } from './social/service.js';
import { createDbSocialStore } from './social/store.js';
import { registerSocialRoutes } from './social/routes.js';
import { gateForDuel, gateForPath } from './settings/gate.js';
import { RateLimiter } from './security/rate-limit.js';
import { registerSecurityHeaders } from './security/headers.js';
import { checkProductionConfig } from './security/config.js';
import { createDbNotifyStore } from './notify/store.js';
import type { NotifyStore } from './notify/store.js';
import { BALE_TEXT } from './notify/texts.js';
import { createDbSettingsStore } from './settings/db-store.js';
import { SettingsService } from './settings/service.js';
import type { AdminRepository } from './admin/routes.js';
import { registerCatalogRoutes, registerLookupRoutes } from './catalog/routes.js';
import { isMainModule } from './is-main.js';
import { createDbPuzzleSource } from './solo/db-source.js';
import { CoinPackageService } from './economy/coin-packages.js';
import { registerCoinPackageRoutes } from './economy/coin-packages-routes.js';
import { createDbCoinPackageStore } from './economy/coin-packages-store.js';
import { registerShopRoutes } from './economy/shop-routes.js';
import { ShopService } from './economy/shop.js';
import { createDbShopStore } from './economy/shop-store.js';
import { HintService } from './solo/hints.js';
import { PlayLimiter, createDbPlayCountStore } from './limits/play-limits.js';
import { registerSoloRoutes } from './solo/routes.js';
import { SoloService } from './solo/service.js';
import type { CatalogRepository } from './catalog/routes.js';

export interface ServerDeps {
  /** Behind a reverse proxy: trust `X-Forwarded-For` for the client IP (needed for the per-IP rate limits to see real clients). */
  trustProxy?: boolean;
  catalog?: CatalogRepository;
  /** Interim catalog review page + API at `/admin`; registered only when a token is provided. */
  admin?: { repo: AdminRepository; token?: string; accounts?: AdminAccounts };
  /** Guest accounts and sessions (`/auth/guest`, `/me`). */
  auth?: AuthService;
  /** Daily reward (`/daily-reward`, and the admin editor); needs `auth` for the player routes. */
  dailyReward?: DailyRewardService;
  /** Socket.io service (queue, matches); needs `auth`. Its live stats feed the admin panel. */
  realtime?: boolean;
  /** Bale messenger integration: link codes for players, the bot's name for the app. */
  bale?: { service: NotifyService; botUsername: string | null };
  /** Mobile numbers (`/me/phone`); also required before Bale linking when the setting says so. */
  phone?: PhoneService;
  /** Public ID, search, contacts, invite link; needs `auth`. */
  find?: FindService;
  /** Badges, medals, notices, mutes and the agent's powers; needs `auth`. */
  badges?: BadgeService;
  /** City chat and canned taunts; needs `auth`. */
  chat?: ChatService;
  /** Tournaments (list, page, join); needs `auth`. */
  tournaments?: TournamentService;
  /** The daily puzzle; needs `auth`. */
  daily?: DailyService;
  /** Filled with the live-match service once the socket gateway exists, so tournaments can start duels. */
  live?: { matches?: MatchService; queue?: DuelQueue };
  /** Bot players: reacts to the events pushed to bot accounts (needs the gateway). */
  botDriver?: BotDriver;
  /** Admin message center; its in-app channel feeds `GET /inbox`. */
  messages?: MessageCenter;
  /** Public profiles, friend requests and the gender setting. */
  social?: SocialService;
  /** Invite ("gold") codes; needs `auth`. */
  invite?: InviteService;
  /** Gifts and loans between friends; needs `auth`. */
  transfers?: TransferService;
  /** Where live matches get puzzles and player cards from; without it queue pairs are put back in line. */
  match?: Omit<MatchDeps, 'emit'>;
  /** Admin-editable tunables; also served to clients at `GET /config`. */
  settings?: SettingsService;
  /** Extra admin panel modules (products editor, users, stats, bot, audit). */
  adminModules?: Omit<AdminModules, 'settings'>;
  /** Solo practice sessions (`/solo/*`). */
  solo?: SoloService;
  /** Paid hints of solo games; needs `solo` and `auth`. */
  hints?: HintService;
  /** Admin-set daily game caps (solo, live duel). */
  limiter?: PlayLimiter;
  /** Coin shop (`/shop`); needs `auth`. */
  shop?: ShopService;
  /** Coin packages bought with real money (`/coin-packages`, off by default); needs `auth`. */
  coinPackages?: CoinPackageService;
  /** Allowed browser origins (e.g. Expo web dev). `*` allows any. Off when unset: native apps don't need CORS. */
  corsOrigin?: string;
  /** Docker-free dev: directory of uploaded product images, served at `/images/*`. */
  localImagesDir?: string;
}

export function buildServer(deps: ServerDeps = {}) {
  // Small bodies only: every JSON payload of this API is a few hundred bytes.
  const app = Fastify({ logger: true, bodyLimit: 64 * 1024, trustProxy: deps.trustProxy ?? false });
  registerSecurityHeaders(app, { hsts: process.env.NODE_ENV === 'production' });

  // Never leak internals: 5xx are logged and answered generically, 4xx carry only a short code.
  app.setErrorHandler((err: { statusCode?: number; code?: string }, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
    if (status >= 500) {
      req.log.error({ err }, 'request failed');
      return reply.code(500).send({ error: 'internal' });
    }
    return reply.code(status).send({ error: status === 413 ? 'payload_too_large' : status === 429 ? 'rate_limited' : 'invalid_request' });
  });

  // Per-IP request limits: a general one, and a tight one on account creation.
  const anyLimit = new RateLimiter(300, 60_000);
  const guestLimit = new RateLimiter(20, 60_000);
  app.addHook('onRequest', async (req, reply) => {
    if (deps.settings) {
      const verdict = await gateForPath(deps.settings, req.url.split('?')[0] ?? '');
      if (verdict) return reply.code(503).send(verdict);
    }
    const limited = !anyLimit.take(req.ip) ? anyLimit : req.url.split('?')[0] === '/auth/guest' && !guestLimit.take(req.ip) ? guestLimit : null;
    if (limited) return reply.header('retry-after', String(limited.retryAfterSec(req.ip))).code(429).send({ error: 'rate_limited' });
  });

  app.get('/health', async () => ({
    status: 'ok',
    // proves apps/server -> packages/shared wiring at boot, not real game logic yet.
    sample: rialsToTomanString(1_500),
  }));

  if (deps.corsOrigin) {
    void app.register(fastifyCors, { origin: deps.corsOrigin === '*' ? true : deps.corsOrigin.split(',').map((o) => o.trim()) });
  }
  if (deps.auth) registerAuthRoutes(app, deps.auth);
  if (deps.auth && deps.dailyReward) registerDailyRewardRoutes(app, deps.auth, deps.dailyReward);
  if (deps.auth && deps.social) registerSocialRoutes(app, deps.auth, deps.social);
  if (deps.auth && deps.invite) registerInviteRoutes(app, deps.auth, deps.invite);
  if (deps.auth && deps.transfers) registerTransferRoutes(app, deps.auth, deps.transfers);
  if (deps.auth && deps.messages) registerInboxRoutes(app, deps.auth, deps.messages);
  if (deps.auth && deps.phone) registerPhoneRoutes(app, deps.auth, deps.phone);
  if (deps.auth && deps.find) registerFindRoutes(app, deps.auth, deps.find);
  if (deps.auth && deps.badges) registerBadgeRoutes(app, deps.auth, deps.badges);
  if (deps.auth && deps.chat) registerChatRoutes(app, deps.auth, deps.chat);
  if (deps.auth && deps.tournaments) registerTournamentRoutes(app, deps.auth, deps.tournaments);
  if (deps.auth && deps.daily) registerDailyRoutes(app, deps.auth, deps.daily);
  if (deps.auth && deps.bale) {
    const phoneSvc = deps.phone;
    const settings = deps.settings;
    registerBaleRoutes(app, deps.auth, deps.bale.service, deps.bale.botUsername, phoneSvc ? { service: phoneSvc, required: async () => (settings ? (await settings.num('phone.required_for_bale')) === 1 : true) } : undefined);
  }
  if (deps.settings) {
    const settings = deps.settings;
    app.get('/config', async () => ({ settings: await settings.publicValues() }));
  }
  if (deps.catalog) {
    registerCatalogRoutes(app, deps.catalog);
    registerLookupRoutes(app, deps.catalog);
  }
  if (deps.solo) registerSoloRoutes(app, deps.solo, deps.auth, deps.hints, deps.limiter);
  if (deps.auth && deps.shop) registerShopRoutes(app, deps.auth, deps.shop);
  if (deps.auth && deps.coinPackages) registerCoinPackageRoutes(app, deps.auth, deps.coinPackages);
  let gateway: Gateway | undefined;
  if (deps.auth && deps.realtime) {
    const auth = deps.auth;
    gateway = attachGateway(app.server, { authenticate: (t) => auth.authenticate(t), corsOrigin: deps.corsOrigin, match: deps.match, gate: deps.settings ? () => gateForDuel(deps.settings!) : undefined, limit: deps.limiter ? { canPlay: async (u) => (await deps.limiter!.check(u, 'duel')).ok, onStarted: (u) => deps.limiter!.record(u, 'duel') } : undefined, chat: deps.chat, onEmit: deps.botDriver ? (u, e, p) => deps.botDriver!.onEmit(u, e, p) : undefined });
    if (deps.live) {
      deps.live.matches = gateway.matches;
      deps.live.queue = gateway.queue;
    }
    app.addHook('onClose', async () => {
      await gateway?.close();
    });
  }
  if (deps.admin) registerAdminRoutes(app, deps.admin.repo, deps.admin.token, { accounts: deps.admin.accounts, dailyReward: deps.dailyReward, socketStats: gateway?.stats, settings: deps.settings, ...deps.adminModules });
  if (deps.localImagesDir) {
    void app.register(fastifyStatic, { root: resolve(deps.localImagesDir), prefix: '/images/' });
  }

  return app;
}

/** Live tunables for the daily reward (admin settings). */
async function dailyRules(settings: SettingsService) {
  return { cooldownHours: await settings.num('economy.daily_cooldown_hours'), windowHours: await settings.num('economy.daily_streak_window_hours') };
}

/** Live tunables for paid hints (admin settings). */
async function hintRules(settings: SettingsService): Promise<HintRules> {
  const [t, o, p, minLevel, maxPerGame, repeatPercent] = await Promise.all(['hint.price_group_title', 'hint.price_one_card', 'hint.price_pair', 'hint.min_level', 'hint.max_per_game', 'hint.repeat_percent'].map((k) => settings.num(k)));
  return { prices: { group_title: t!, one_card: o!, pair: p! }, minLevel: minLevel!, maxPerGame: maxPerGame!, repeatPercent: repeatPercent! };
}

/** Live tunables for solo games and the price-guess staircase (admin settings). */
async function soloRules(settings: SettingsService) {
  const pct = await settings.list('score.staircase_error_pct');
  const points = await settings.list('score.staircase_points');
  return {
    maxMistakes: await settings.num('game.solo_max_mistakes'),
    tiers: pct.map((maxErrorPct, i) => ({ maxErrorPct, points: points[i] ?? 1 })),
    minPoints: await settings.num('score.guess_min_points'),
  };
}

if (isMainModule(import.meta.url)) {
  const problems = checkProductionConfig(process.env);
  for (const w of problems.warn) console.warn(`[security] ${w}`);
  if (problems.fatal.length > 0) throw new Error(`Refusing to start: ${problems.fatal.join('; ')}`);
  const db = process.env.DATABASE_URL ? createDb() : undefined;
  const adminToken = process.env.ADMIN_TOKEN;
  const jwtSecret = process.env.JWT_SECRET ?? (process.env.NODE_ENV === 'production' ? undefined : 'dev-only-secret-change-me');
  if (db && !jwtSecret) throw new Error('JWT_SECRET is required in production');
  const auth = db && jwtSecret ? new AuthService(createDbUserRepository(db), createTokenSigner(jwtSecret)) : undefined;
  const settings = db ? new SettingsService(createDbSettingsStore(db)) : undefined;
  const baleToken = process.env.BALE_BOT_TOKEN;
  const baleUsername = process.env.BALE_BOT_USERNAME?.replace(/^@/, '') ?? null;
  const baleClient = baleToken ? createBaleClient(baleToken, { base: process.env.BALE_API_BASE }) : null;
  const baleStore: NotifyStore | undefined = db ? createDbNotifyStore(db) : undefined;
  const notify = baleStore ? new NotifyService(baleStore, baleClient) : undefined;
  const smsClient = process.env.KAVENEGAR_API_KEY && process.env.KAVENEGAR_TEMPLATE ? createKavenegarClient(process.env.KAVENEGAR_API_KEY, process.env.KAVENEGAR_TEMPLATE) : null;
  const phone = db && settings ? new PhoneService(createDbPhoneStore(db), () => phoneRulesFromSettings(settings), smsClient) : undefined;
  if (notify && phone) notify.phone = phone;
  const words = db ? new TextFilterService(createDbWordStore(db)) : undefined;
  const playerStore = db ? createDbPlayerStore(db) : undefined;
  const inviteStore = db ? createDbInviteStore(db) : undefined;
  const player = playerStore && settings ? new PlayerService(playerStore, () => rulesFromSettings(settings), words, inviteStore ? (id) => inviteStore.isActivated(id) : undefined) : undefined;
  const socialStore = db ? createDbSocialStore(db) : undefined;
  const badgeStore = db ? createDbBadgeStore(db) : undefined;
  const badges =
    badgeStore && settings && player && socialStore
      ? new BadgeService(
          badgeStore,
          async (id) => {
            const { level, stats } = await player.levelOf(id);
            return { games: stats.games, wins: stats.wins, level: level.level };
          },
          () => skillRulesFromSettings(settings),
          () => modRulesFromSettings(settings),
          async (id) => (await socialStore.publicRow(id)) !== null,
          Date.now,
          (id, text) => void notify?.notify(id, 'admin', text).catch(() => undefined),
        )
      : undefined;
  const social = db && socialStore
    ? new SocialService(
        socialStore,
        Date.now,
        (targetId, nickname) => {
          void notify?.notify(targetId, 'friend_request', BALE_TEXT.friendRequest(nickname)).catch(() => undefined);
        },
        player,
        badges,
      )
    : undefined;
  const messages = db ? new MessageCenter(createDbMessageStore(db), notify ?? null) : undefined;
  const invite = inviteStore && settings && player ? new InviteService(inviteStore, () => inviteRulesFromSettings(settings), async (id) => (await player.levelOf(id)).level.level, async (id) => (await player.levelOf(id)).stats.games, () => randomInt(0, 2 ** 30) / 2 ** 30) : undefined;
  if (player) {
    player.afterGame = async (id) => {
      await invite?.settle(id);
      await badges?.evaluate(id);
    };
  }
  const chatStore = db ? createDbChatStore(db) : undefined;
  const chat =
    chatStore && settings && player && socialStore && badges && inviteStore
      ? new ChatService(chatStore, {
          cityOf: (id) => player.cityOf(id),
          profileOf: async (id) => socialStore.publicRow(id),
          badgeTitleOf: async (id) => (await badges.publicOf(id)).badge?.titleFa ?? null,
          isActivated: (id) => inviteStore.isActivated(id),
          mute: (id) => badges.isMuted(id),
          hasContactPerk: (id) => badges.hasPerk(id, 'share_contact'),
          rules: () => chatRulesFromSettings(settings),
          filter: words,
        })
      : undefined;
  const live: { matches?: MatchService; queue?: DuelQueue } = {};
  const botStore = db ? createDbBotPlayerStore(db) : undefined;
  const botDriver =
    botStore && settings
      ? new BotDriver({
          store: botStore,
          matches: () => live.matches,
          queue: () => live.queue,
          chat: () => chat,
          settings: async () => ({ enabled: (await settings.num('bots.enabled')) === 1, fallbackSec: await settings.num('bots.fallback_seconds'), jitterSec: await settings.num('bots.fallback_jitter_seconds'), cityReplyPercent: await settings.num('bots.city_reply_percent') }),
          taunts: chatStore ? async () => (await chatStore.taunts()).map((c) => ({ nameFa: c.nameFa, ids: c.taunts.map((t) => t.id) })) : undefined,
          rng: () => randomInt(0, 2 ** 30) / 2 ** 30,
        })
      : undefined;
  if (chat && botDriver) chat.onCityMessage = (cityId, message) => void botDriver.onCityMessage(cityId, message);
  const tournamentService =
    db && settings && player && socialStore
      ? new TournamentService(createDbTournamentStore(db), {
          levelOf: async (id) => (await player.levelOf(id)).level.level,
          profileOf: async (id) => socialStore.publicRow(id),
          startMatch: async (a, b) => (live.matches ? live.matches.start(a, b) : false),
          inMatch: (id) => live.matches?.inMatch(id) ?? false,
          fillBots: (n) => botDriver?.fillSeats(n) ?? [],
          isBot: (id) => botDriver?.isBot(id) ?? false,
          notify: (id, text) => void notify?.notify(id, 'admin', text).catch(() => undefined),
        })
      : undefined;
  const transfers = db && settings && socialStore && inviteStore ? new TransferService(createDbTransferStore(db), socialStore, () => transferRulesFromSettings(settings), async (id) => (player ? (await player.levelOf(id)).level.level : 1), (id) => inviteStore.isActivated(id)) : undefined;
  const find =
    db && settings && socialStore
      ? new FindService(
          createDbFindStore(db),
          socialStore,
          async () => ({
            inviteBase: await settings.text('link.invite_base'),
            shortenerUrl: await settings.text('link.shortener_url'),
            autoFriendHours: await settings.num('friend.link_auto_hours'),
            autoFriendPerDay: await settings.num('friend.link_auto_per_day'),
          }),
          createShortener(),
          () => randomInt(0, 2 ** 30) / 2 ** 30,
        )
      : undefined;
  const levelOf = async (id: string) => (player ? (await player.levelOf(id)).level.level : 1);
  const shopStore = db ? createDbShopStore(db) : undefined;
  const coinPackageService = db ? new CoinPackageService(createDbCoinPackageStore(db), levelOf) : undefined;
  let dailyRef: DailyService | undefined;
  const solo =
    db && settings
      ? new SoloService(createDbPuzzleSource(db), {
          rules: () => soloRules(settings),
          onFinished: (id, outcome, tag) => {
            void player?.recordGame(id, { mode: 'solo', outcome });
            void dailyRef?.onFinished(id, outcome, tag).catch((err) => console.error('daily finish failed', err));
          },
        })
      : undefined;
  const dailyStore = db ? createDbDailyStore(db) : undefined;
  const daily = dailyStore && solo && settings ? new DailyService(dailyStore, solo, { num: (k) => settings.num(k) }) : undefined;
  dailyRef = daily;
  const botRepo = db ? createDbBotRepository(db) : undefined;
  const bot = botRepo ? new BotService(botRepo) : undefined;
  const app = buildServer({
    auth,
    settings,
    adminModules: db
      ? { products: createDbProductAdmin(db), stats: createDbStatsAdmin(db), users: createDbUsersAdmin(db), audit: createDbAuditLog(db), words, cities: playerStore, shop: shopStore, coinPackages: coinPackageService, invites: inviteStore, badges: badgeStore && badges ? { store: badgeStore, service: badges } : undefined, chat: chatStore, tournaments: tournamentService, daily, botPlayers: botStore && player && settings ? { service: new BotPlayerService(botStore, () => rulesFromSettings(settings).then((r) => r.xp), () => randomInt(0, 2 ** 30) / 2 ** 30, async (id) => player.afterGame?.(id)), cities: async () => (playerStore ? (await playerStore.cities()).map((c) => c.id) : []) } : undefined, messages, bale: notify && baleStore ? { service: notify, store: baleStore, botUsername: baleUsername } : undefined, bot: botRepo && bot ? { repo: botRepo, service: bot } : undefined }
      : undefined,
    realtime: Boolean(auth),
    match: db
      ? {
          puzzles: createDbPuzzleSource(db),
          profile: createDbProfileLookup(db, player ? async (id) => (await player.levelOf(id)).level.level : undefined),
          onEnded: ({ players, result }) => {
            if (tournamentService) void tournamentService.onMatchEnded(players, result.winner);
            if (result.reason !== 'abandon') {
              players.forEach((id, side) => void player?.recordGame(id, { mode: 'duel', outcome: result.winner === null ? 'draw' : result.winner === side ? 'win' : 'loss' }));
            }
            if (!notify || !settings) return;
            void (async () => {
              if ((await settings.num('notify.match_result')) !== 1) return;
              players.forEach((id, side) => {
                const reason = BALE_TEXT.reasons[result.reason] ?? '';
                const text = result.winner === null ? BALE_TEXT.matchDraw : result.winner === side ? BALE_TEXT.matchWon(reason) : BALE_TEXT.matchLost(reason);
                void notify.notify(id, 'match_result', text);
              });
            })().catch(() => undefined);
          },
        }
      : undefined,
    bale: notify ? { service: notify, botUsername: baleUsername } : undefined,
    phone,
    find,
    badges,
    chat,
    tournaments: tournamentService,
    daily,
    live,
    botDriver,
    messages,
    social,
    invite,
    transfers,
    dailyReward: db && settings ? new DailyRewardService(createDbDailyRewardStore(db), Date.now, () => dailyRules(settings)) : undefined,
    catalog: db ? createDbCatalogRepository(db) : undefined,
    solo,
    limiter: db && settings ? new PlayLimiter(createDbPlayCountStore(db), async (mode) => settings.num(mode === 'solo' ? 'limit.solo_per_day' : 'limit.duel_per_day')) : undefined,
    hints: solo && shopStore && settings ? new HintService(solo, shopStore, () => hintRules(settings), levelOf) : undefined,
    shop: shopStore ? new ShopService(shopStore, levelOf) : undefined,
    coinPackages: coinPackageService,
    admin: db && jwtSecret ? { repo: createDbAdminRepository(db), token: adminToken, accounts: new AdminAccounts(createDbAdminStore(db), jwtSecret, adminToken) } : undefined,
    corsOrigin: process.env.CORS_ORIGIN,
    trustProxy: process.env.TRUST_PROXY === '1',
    localImagesDir: process.env.LOCAL_IMAGES_DIR,
  });
  if (botDriver) {
    void botDriver.refresh().catch(() => undefined);
    const botTimer = setInterval(() => void botDriver.tick().catch((err) => app.log.error({ err }, 'bot tick failed')), 5000);
    botTimer.unref();
    app.addHook('onClose', async () => clearInterval(botTimer));
  }
  if (tournamentService) {
    const timer = setInterval(() => void tournamentService.tick().catch((err) => app.log.error({ err }, 'tournament tick failed')), TOURNAMENT_TICK_SECONDS * 1000);
    timer.unref();
    app.addHook('onClose', async () => clearInterval(timer));
  }
  if (chat) {
    // Retention: chat history is kept 30 days for moderation, then purged (checked every 6 hours).
    const timer = setInterval(() => void chat.purge(CHAT_RETENTION_DAYS).catch(() => undefined), 6 * 3_600_000);
    timer.unref();
    app.addHook('onClose', async () => clearInterval(timer));
  }
  if (bot && settings && process.env.BOT_SCHEDULER !== 'off') {
    const scheduler = startBotScheduler({ bot, settings, log: (msg, err) => (err ? app.log.error({ err }, msg) : app.log.info(msg)) });
    app.addHook('onClose', async () => scheduler.stop());
  }
  if (notify && baleClient) {
    const runner = startNotifyRunner({ service: notify, client: baleClient, settings, log: (msg, err) => (err ? app.log.error({ err }, msg) : app.log.info(msg)) });
    app.addHook('onClose', async () => runner.stop());
  }
  const port = Number(process.env.PORT ?? 3000);
  app.listen({ port, host: '0.0.0.0' }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
