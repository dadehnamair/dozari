import { randomInt, randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { resolve } from 'node:path';
import { rialsToTomanString } from '@dozari/shared';
import { CHAT_RETENTION_DAYS, MISSION_KEYS, TOURNAMENT_TICK_SECONDS, WHEEL_SLICES_DEFAULT, scaleSlices } from '@dozari/shared';
import type { HintRules, MissionKey } from '@dozari/shared';
import { createDb } from '@dozari/db';
import { createDbCatalogRepository } from './catalog/db-repository.js';
import { DailyRewardService } from './economy/daily-reward.js';
import { createDbDailyRewardStore } from './economy/daily-reward-db.js';
import { registerDailyRewardRoutes } from './economy/routes.js';
import { AuthService } from './auth/service.js';
import { createDbUserRepository } from './auth/db-repository.js';
import { createClientRecorder, parseClientInfo } from './clients/info.js';
import type { ClientInfoStore } from './clients/info.js';
import { createDbClientInfoStore } from './clients/store.js';
import { attachGateway } from './realtime/gateway.js';
import { Presence } from './realtime/presence.js';
import { createLiveNotices } from './realtime/notices.js';
import type { LiveNotices } from './realtime/notices.js';
import type { Gateway } from './realtime/gateway.js';
import type { MatchDeps } from './realtime/match-service.js';
import { PlayerService, rulesFromSettings } from './player/service.js';
import { LevelTable, createDbLevelTableStore } from './progress/table.js';
import { defaultLevelTable } from '@dozari/shared';
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
import { createDbSponsorStore } from './sponsor/store.js';
import { BotDriver } from './botplayers/driver.js';
import { BotPlayerService } from './botplayers/service.js';
import { createDbBotPlayerStore } from './botplayers/store.js';
import { registerFindRoutes } from './find/routes.js';
import { registerLedgerRoutes } from './ledger/routes.js';
import { createDbLedgerReader } from './ledger/store.js';
import type { LedgerReader } from './ledger/store.js';
import { FindService } from './find/service.js';
import { createShortener } from './find/shortener.js';
import { createDbFindStore } from './find/store.js';
import { PhoneLoginService } from './phone/login.js';
import { registerPhoneLoginRoutes, registerPhoneRoutes } from './phone/routes.js';
import { PhoneService, phoneRulesFromSettings } from './phone/service.js';
import { createIrnotiClient, createKavenegarClient } from './phone/sms.js';
import { createDbPhoneStore } from './phone/store.js';
import { registerInviteRoutes } from './invite/routes.js';
import { InviteService, inviteRulesFromSettings } from './invite/service.js';
import { createDbInviteStore } from './invite/store.js';
import { registerCandidateRoutes } from './realtime/candidates.js';
import { createDbProfileLookup } from './realtime/profile.js';
import { AccountDeletion, createDbDeleteCodeStore } from './account/deletion.js';
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
import { BALE_TEXT, BIRTHDAY_TITLE } from './notify/texts.js';
import { createDbSettingsStore } from './settings/db-store.js';
import { SettingsService } from './settings/service.js';
import type { AdminRepository } from './admin/routes.js';
import { registerCatalogRoutes, registerLookupRoutes } from './catalog/routes.js';
import { isMainModule } from './is-main.js';
import { createDbPuzzleSource } from './solo/db-source.js';
import { createQueueDiagnosis } from './realtime/diagnose.js';
import { CoinPackageService } from './economy/coin-packages.js';
import { createDbPuzzleAdmin } from './puzzles/admin.js';
import { startPuzzlePoolScheduler } from './puzzles/pool.js';
import { registerCoinPackageRoutes } from './economy/coin-packages-routes.js';
import { createDbCoinPackageStore } from './economy/coin-packages-store.js';
import { ShopRealMoney } from './economy/shop-real.js';
import { createDbLandingStore } from './landing/store.js';
import { LandingService } from './landing/service.js';
import { registerLandingPublicRoutes } from './landing/routes.js';
import { createDbShortLinkStore } from './shortlinks/store.js';
import { ShortLinkService } from './shortlinks/service.js';
import { handleShortHost, registerShortLinkRoutes } from './shortlinks/routes.js';
import { registerShopPayRoutes, registerShopRoutes } from './economy/shop-routes.js';
import { LevelRoadService, registerRoadRoutes } from './progress/road.js';
import { createDbRewardStore } from './progress/rewards-store.js';
import { ProfileTaskService, registerProfileTaskRoutes } from './profile/tasks.js';
import { createDbGemWallet, registerGemRoutes } from './economy/gems.js';
import type { GemWalletReader } from './economy/gems.js';
import { createDbProfileTaskStore } from './profile/tasks-store.js';
import { BirthdayService, registerBirthdayRoutes } from './profile/birthday.js';
import { createErrorReporter } from './errors/report.js';
import { buildFeedbackService } from './feedback/build.js';
import { applyLedgerEntry } from './economy/ledger.js';
import type { FeedbackService } from './feedback/service.js';
import { registerFeedbackRoutes } from './feedback/routes.js';
import { createDbBirthdayStore } from './profile/birthday-store.js';
import { AgeTrackService, registerAgeTrackRoutes } from './agetrack/service.js';
import { createDbAgeTrackStore } from './agetrack/store.js';
import { createDbAgeTrackAdmin } from './agetrack/overview.js';
import { GuardianService, registerGuardianRoutes } from './guardian/service.js';
import { createDbGuardianStore } from './guardian/store.js';
import { GuardianSettingsService, createDbGuardianSettingsStore } from './guardian/settings.js';
import { registerLessonRoutes } from './lessons/service.js';
import type { LessonStore } from './lessons/service.js';
import { createDbLessonStore } from './lessons/store.js';
import { ShopService } from './economy/shop.js';
import { createDbShopStore } from './economy/shop-store.js';
import { HintService } from './solo/hints.js';
import { PlayLimiter, createDbPlayCountStore } from './limits/play-limits.js';
import { DuelStakes } from './duel/stakes.js';
import { registerWheelRoutes } from './wheel/routes.js';
import { WheelService } from './wheel/service.js';
import { createDbWheelStore } from './wheel/store.js';
import { createDbStakeStore } from './duel/stakes-store.js';
import { TableService } from './tables/service.js';
import { registerTableRoutes } from './tables/routes.js';
import { currentUser } from './auth/routes.js';
import { registerSoloRoutes } from './solo/routes.js';
import { registerPriceOnlyRoutes } from './priceonly/routes.js';
import { PriceOnlyService } from './priceonly/service.js';
import { createDbPriceOnlySource } from './priceonly/db-source.js';
import { SoloService } from './solo/service.js';
import type { CatalogRepository } from './catalog/routes.js';

export interface ServerDeps {
  /** Behind a reverse proxy: trust `X-Forwarded-For` for the client IP (needed for the per-IP rate limits to see real clients). */
  trustProxy?: boolean;
  /** Called with every unexpected server error (and crash); wired to the self-hosted collector by `SENTRY_DSN`. */
  reportError?: (err: unknown, where?: string) => void;
  catalog?: CatalogRepository;
  /** Interim catalog review page + API at `/admin`; registered only when a token is provided. */
  admin?: { repo: AdminRepository; token?: string; accounts?: AdminAccounts };
  /** Guest accounts and sessions (`/auth/guest`, `/me`). */
  auth?: AuthService;
  /** Remembers the platform / app version / market each signed-in player's app reports (admin panel «آخرین دستگاه»). */
  clientInfo?: ClientInfoStore;
  /** Daily reward (`/daily-reward`, and the admin editor); needs `auth` for the player routes. */
  dailyReward?: DailyRewardService;
  /** Lucky wheel: a spin earned by winning a duel. */
  wheel?: WheelService;
  /** Socket.io service (queue, matches); needs `auth`. Its live stats feed the admin panel. */
  realtime?: boolean;
  /** Bale messenger integration: link codes for players, the bot's name for the app. */
  bale?: { service: NotifyService; botUsername: string | null };
  /** Mobile numbers (`/me/phone`); also required before Bale linking when the setting says so. */
  phone?: PhoneService;
  /** «ورود با شماره»: logged-out sign-in by SMS code (`/auth/phone/*`). */
  phoneLogin?: PhoneLoginService;
  /** Public ID, search, contacts, invite link; needs `auth`. */
  find?: FindService;
  deletion?: AccountDeletion;
  ledger?: LedgerReader;
  /** Badges, medals, notices, mutes and the agent's powers; needs `auth`. */
  badges?: BadgeService;
  /** City chat and canned taunts; needs `auth`. */
  chat?: ChatService;
  /** Tournaments (list, page, join); needs `auth`. */
  tournaments?: TournamentService;
  /** The daily puzzle; needs `auth`. */
  daily?: DailyService;
  /** Filled with the live-match service once the socket gateway exists, so tournaments can start duels. */
  live?: { matches?: MatchService; queue?: DuelQueue; teamQueue?: DuelQueue };
  /** Bot players: reacts to the events pushed to bot accounts (needs the gateway). */
  botDriver?: BotDriver;
  /** Live-socket tracker shared by the gateway and the friends list. */
  presence?: Presence;
  /** Blog, cast and FAQ for the landing site: `/public/*` and the admin pages. */
  landing?: LandingService;
  /** Self-hosted short links: `/s/:code` everywhere and the whole short domain. */
  shortLinks?: ShortLinkService;
  /** Live «something new» pushes (friend request, inbox message) over the socket. */
  notices?: LiveNotices;
  /** Bale outbox, used to nudge an offline friend about a table invite. */
  notify?: NotifyService;
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
  /** Is this player's level enough for the live duel queue (`duel.min_level`)? Absent = everyone may. */
  duelLevelGate?: (userId: string) => Promise<boolean>;
  /** Price-only games (`/price-only/*`). */
  priceOnly?: PriceOnlyService;
  /** Paid hints of solo games; needs `solo` and `auth`. */
  hints?: HintService;
  /** Private tables (`/tables`); needs `auth` and the live-match service. */
  tables?: TableService;
  /** Coin stakes of queue duels (entry, payout, free matches, rescue). */
  duelStakes?: DuelStakes;
  /** Admin-set daily game caps (solo, live duel). */
  limiter?: PlayLimiter;
  /** Coin shop (`/shop`); needs `auth`. */
  shop?: ShopService;
  /** Level road (`/me/levels`, D109); needs `auth`. */
  levelRoad?: LevelRoadService;
  profileTasks?: ProfileTaskService;
  /** Birth date, birthday week, yearly gift and friend messages (D160). */
  birthday?: BirthdayService;
  /** Chosen age track: kid / teen / adult (D198); queues only pair one track. */
  ageTracks?: AgeTrackService;
  /** Kid word lessons (D198). */
  lessons?: LessonStore;
  /** Guardian links: child profiles, link codes, band-change approval (D198). */
  guardian?: GuardianService;
  /** Reports of players and the suggestion / vote / approve loop (D177). */
  feedback?: FeedbackService;
  gems?: Pick<GemWalletReader, 'wallet'>;
  /** Coin packages bought with real money (`/coin-packages`, off by default); needs `auth`. */
  coinPackages?: CoinPackageService;
  /** Shop items bought with real money (`/shop-pay`, behind the same switch as coin packages). */
  shopReal?: ShopRealMoney;
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
      deps.reportError?.(err, `${req.method} ${req.routeOptions?.url ?? 'unknown'}`);
      return reply.code(500).send({ error: 'internal' });
    }
    return reply.code(status).send({ error: status === 413 ? 'payload_too_large' : status === 429 ? 'rate_limited' : 'invalid_request' });
  });

  // Per-IP request limits: a general one, and a tight one on account creation.
  const anyLimit = new RateLimiter(300, 60_000);
  const guestLimit = new RateLimiter(20, 60_000);
  app.addHook('onRequest', async (req, reply) => {
    if (deps.settings && deps.shortLinks) {
      // A request that arrives on the short domain is a short link (or the home redirect), answered before any other rule.
      const host = (req.headers.host ?? '').split(':')[0]?.toLowerCase() ?? '';
      const short = (await deps.settings.text('domain.short')).trim().toLowerCase();
      if (short && host === short) {
        const landing = (await deps.settings.text('domain.landing')).trim();
        const out = await handleShortHost(deps.shortLinks, req.url.split('?')[0] ?? '/', landing ? `https://${landing}` : null);
        return out.location ? reply.header('cache-control', 'no-store').redirect(out.location, 302) : reply.code(404).send({ error: 'not_found' });
      }
    }
    if (deps.settings) {
      const verdict = await gateForPath(deps.settings, req.url.split('?')[0] ?? '');
      if (verdict) return reply.code(503).send(verdict);
    }
    const limited = !anyLimit.take(req.ip) ? anyLimit : req.url.split('?')[0] === '/auth/guest' && !guestLimit.take(req.ip) ? guestLimit : null;
    if (limited) return reply.header('retry-after', String(limited.retryAfterSec(req.ip))).code(429).send({ error: 'rate_limited' });
  });

  if (deps.auth && deps.clientInfo) {
    // After the response is sent, so it costs the player nothing; a failure is only logged.
    const auth = deps.auth;
    const record = createClientRecorder(deps.clientInfo);
    app.addHook('onResponse', async (req) => {
      const info = parseClientInfo(req.headers);
      const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
      if (!info || !m?.[1]) return;
      try {
        const user = await auth.authenticate(m[1]);
        if (user) await record(user.id, info);
      } catch (err) {
        req.log.warn({ err }, 'client info not recorded');
      }
    });
  }

  app.get('/health', async () => ({
    status: 'ok',
    // proves apps/server -> packages/shared wiring at boot, not real game logic yet.
    sample: rialsToTomanString(1_500),
  }));

  if (deps.corsOrigin) {
    // @fastify/cors ≥10 allows only GET/HEAD/POST by default; the web app also sends PUT, PATCH and DELETE.
    void app.register(fastifyCors, { origin: deps.corsOrigin === '*' ? true : deps.corsOrigin.split(',').map((o) => o.trim()), methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'] });
  }
  if (deps.auth) registerAuthRoutes(app, deps.auth, deps.deletion);
  if (deps.auth && deps.dailyReward) registerDailyRewardRoutes(app, deps.auth, deps.dailyReward);
  if (deps.auth && deps.wheel) registerWheelRoutes(app, deps.auth, deps.wheel);
  if (deps.auth && deps.social) registerSocialRoutes(app, deps.auth, deps.social);
  if (deps.auth && deps.invite) registerInviteRoutes(app, deps.auth, deps.invite);
  if (deps.auth && deps.transfers) registerTransferRoutes(app, deps.auth, deps.transfers);
  if (deps.auth && deps.messages) registerInboxRoutes(app, deps.auth, deps.messages);
  if (deps.auth && deps.phone) registerPhoneRoutes(app, deps.auth, deps.phone);
  if (deps.phoneLogin) registerPhoneLoginRoutes(app, deps.phoneLogin);
  if (deps.auth && deps.match && deps.presence) registerCandidateRoutes(app, deps.auth, { online: () => deps.presence!.onlineIds(), bots: () => deps.botDriver?.rosterIds() ?? [], profile: deps.match.profile });
  if (deps.auth && deps.find) registerFindRoutes(app, deps.auth, deps.find);
  if (deps.auth && deps.ledger) registerLedgerRoutes(app, deps.auth, deps.ledger);
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
    // `phoneLogin` tells the app whether a sign-in screen can work (an SMS provider is configured).
    app.get('/config', async () => ({ settings: await settings.publicValues(), phoneLogin: deps.phoneLogin?.available === true }));
  }
  if (deps.catalog) {
    registerCatalogRoutes(app, deps.catalog);
    registerLookupRoutes(app, deps.catalog);
  }
  // Is the player in a live match right now? (the app shows a "back to your game" banner, D42)
  if (deps.auth && deps.live) {
    const auth = deps.auth;
    const live = deps.live;
    app.get('/match/active', async (req, reply) => {
      const user = await currentUser(auth, req);
      if (!user) return reply.code(401).send({ error: 'unauthorized' });
      return { active: live.matches?.inMatch(user.id) ?? false };
    });
  }
  if (deps.auth && deps.tables) registerTableRoutes(app, deps.auth, deps.tables, deps.chat ? async (u, code, label) => { const r = await deps.chat!.sendCity(u, { kind: 'table', code, label }); return r.ok ? { ok: true } : { ok: false, error: r.error }; } : undefined, deps.chat ? async (host, friendId, t) => {
    const r = await deps.chat!.sendDm(host, friendId, { kind: 'table', code: t.code, label: `${t.icon}|${t.name}` });
    if (!r.ok) return { ok: false, error: r.error };
    const online = deps.presence?.isOnline(friendId) ?? false;
    if (!online) void deps.notify?.notify(friendId, 'table_invite', BALE_TEXT.tableInvite(r.message.nickname)).catch(() => undefined);
    return { ok: true, online };
  } : undefined);
  if (deps.solo) registerSoloRoutes(app, deps.solo, deps.auth, deps.hints, deps.limiter);
  if (deps.priceOnly) registerPriceOnlyRoutes(app, deps.priceOnly, deps.auth);
  if (deps.auth && deps.shop) registerShopRoutes(app, deps.auth, deps.shop);
  if (deps.auth && deps.levelRoad) registerRoadRoutes(app, deps.auth, deps.levelRoad);
  if (deps.auth && deps.profileTasks) registerProfileTaskRoutes(app, deps.auth, deps.profileTasks);
  if (deps.auth && deps.birthday) registerBirthdayRoutes(app, deps.auth, deps.birthday);
  if (deps.auth && deps.ageTracks) registerAgeTrackRoutes(app, deps.auth, deps.ageTracks);
  if (deps.auth && deps.lessons) registerLessonRoutes(app, deps.auth, deps.lessons);
  if (deps.auth && deps.guardian) registerGuardianRoutes(app, deps.auth, deps.guardian);
  if (deps.auth && deps.feedback) registerFeedbackRoutes(app, deps.auth, deps.feedback);
  if (deps.auth && deps.gems) registerGemRoutes(app, deps.auth, deps.gems);
  if (deps.landing && deps.settings) registerLandingPublicRoutes(app, deps.landing, deps.settings);
  if (deps.shortLinks) registerShortLinkRoutes(app, deps.shortLinks);
  if (deps.auth && deps.shopReal) registerShopPayRoutes(app, deps.auth, deps.shopReal, deps.notify ? { send: (id, inv) => deps.notify!.sendInvoice(id, inv) } : undefined);
  if (deps.auth && deps.coinPackages) registerCoinPackageRoutes(app, deps.auth, deps.coinPackages, deps.notify ? { send: (id, inv) => deps.notify!.sendInvoice(id, inv) } : undefined);
  let gateway: Gateway | undefined;
  if (deps.auth && deps.realtime) {
    const auth = deps.auth;
    gateway = attachGateway(app.server, { authenticate: (t) => auth.authenticate(t), corsOrigin: deps.corsOrigin, match: deps.match, canAfford: deps.duelStakes ? (u) => deps.duelStakes!.canQueue(u) : undefined, gate: deps.settings ? () => gateForDuel(deps.settings!) : undefined, levelGate: deps.duelLevelGate, limit: deps.limiter ? { canPlay: async (u) => (await deps.limiter!.check(u, 'duel')).ok, onStarted: (u) => deps.limiter!.record(u, 'duel') } : undefined, chat: deps.chat, presence: deps.presence, notices: deps.notices, onEmit: deps.botDriver ? (u, e, p) => deps.botDriver!.onEmit(u, e, p) : undefined, trackOf: deps.ageTracks ? (u) => deps.ageTracks!.effective(u).catch(() => 'adult' as const) : undefined, diagnose: deps.match ? createQueueDiagnosis({ hasPuzzle: async (tracks) => (await deps.match!.puzzles.pickRandom({ tracks })) !== null, botsReady: () => deps.botDriver?.ready() ?? false, graceSec: 45 }) : undefined });
    if (deps.live) {
      deps.live.matches = gateway.matches;
      deps.live.queue = gateway.queue;
      deps.live.teamQueue = gateway.teamQueue;
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
  const auth =
    db && jwtSecret
      ? new AuthService(createDbUserRepository(db), createTokenSigner(jwtSecret), Math.random, async (userId) => {
          // The signup faucet (docs/logic/economy.md): once per new account; the key makes a retry a no-op.
          const bonus = (await settings?.num('economy.signup_bonus')) ?? 0;
          if (bonus > 0) await db.transaction(async (tx) => void (await applyLedgerEntry(tx, { userId, delta: bonus, reason: 'signup_bonus', refType: 'user', refId: userId, idempotencyKey: `signup_bonus:${userId}` })));
        })
      : undefined;
  const settings = db ? new SettingsService(createDbSettingsStore(db)) : undefined;
  const presence = new Presence();
  const notices = createLiveNotices();
  const baleToken = process.env.BALE_BOT_TOKEN;
  const baleUsername = process.env.BALE_BOT_USERNAME?.replace(/^@/, '') ?? null;
  const baleClient = baleToken ? createBaleClient(baleToken, { base: process.env.BALE_API_BASE }) : null;
  const baleStore: NotifyStore | undefined = db ? createDbNotifyStore(db) : undefined;
  const notify = baleStore ? new NotifyService(baleStore, baleClient) : undefined;
  // irnoti wins when both are configured; Kavenegar stays as the fallback adapter.
  const smsClient = process.env.IRNOTI_API_KEY
    ? createIrnotiClient(process.env.IRNOTI_API_KEY, { message: process.env.IRNOTI_MESSAGE })
    : process.env.KAVENEGAR_API_KEY && process.env.KAVENEGAR_TEMPLATE
      ? createKavenegarClient(process.env.KAVENEGAR_API_KEY, process.env.KAVENEGAR_TEMPLATE)
      : null;
  const phone = db && settings ? new PhoneService(createDbPhoneStore(db), () => phoneRulesFromSettings(settings), smsClient, Date.now, undefined, async (id) => {
        const [row, lv] = await Promise.all([socialStore?.publicRow(id), player?.levelOf(id)]);
        return { nickname: row?.nickname ?? '', avatarKey: row?.avatarKey ?? 'avatar-01', level: lv?.level.level ?? 1, coins: row?.coins ?? 0 };
      }) : undefined;
  if (notify && phone) notify.phone = phone;
  const phoneLogin = db && auth ? new PhoneLoginService(createDbPhoneStore(db), auth, smsClient) : undefined;
  const deletion = db ? new AccountDeletion(createDbDeleteCodeStore(db), createDbPhoneStore(db), smsClient, notify ? (id, text) => notify.notify(id, 'security', text) : null) : undefined;
  const words = db ? new TextFilterService(createDbWordStore(db)) : undefined;
  const playerStore = db ? createDbPlayerStore(db) : undefined;
  const inviteStore = db ? createDbInviteStore(db) : undefined;
  const levelTable = db ? new LevelTable(createDbLevelTableStore(db)) : undefined;
  const player = playerStore && settings ? new PlayerService(playerStore, () => rulesFromSettings(settings, levelTable ? () => levelTable.get() : undefined), words, inviteStore ? (id) => inviteStore.isActivated(id) : undefined) : undefined;
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
          notices.push(targetId, { kind: 'friend_request', from: nickname });
        },
        player,
        badges,
        (id) => presence.isOnline(id),
        (ids) => birthday?.info(ids) ?? Promise.resolve(new Map()),
      )
    : undefined;
  const messages = db ? new MessageCenter(createDbMessageStore(db), notify ?? null) : undefined;
  if (messages) {
    // Online recipients get a nudge so the inbox badge moves without a reload; offline ones see it on the next load.
    messages.onDelivered = (ids) => {
      const online = new Set(presence.onlineIds());
      for (const id of ids) if (online.has(id)) notices.push(id, { kind: 'inbox' });
    };
  }
  const invite = inviteStore && settings && player ? new InviteService(inviteStore, () => inviteRulesFromSettings(settings), async (id) => (await player.levelOf(id)).level.level, async (id) => (await player.levelOf(id)).stats.games, () => randomInt(0, 2 ** 30) / 2 ** 30) : undefined;
  if (player) {
    player.afterGame = async (id) => {
      await invite?.settle(id);
      await badges?.evaluate(id);
    };
  }
  const chatStore = db ? createDbChatStore(db) : undefined;
  /** The table service is built after the chat service (the tables need matches); table chat reaches it through this holder. */
  const tableRef: { svc?: TableService } = {};
  const chat =
    chatStore && settings && player && socialStore && badges && inviteStore
      ? new ChatService(chatStore, {
          cityOf: (id) => player.cityOf(id),
          profileOf: async (id) => socialStore.publicRow(id),
          badgeTitleOf: async (id) => (await badges.publicOf(id)).badge?.titleFa ?? null,
          isActivated: (id) => inviteStore.isActivated(id),
          mute: (id) => badges.isMuted(id),
          hasContactPerk: (id) => badges.hasPerk(id, 'share_contact'),
          areFriends: async (a, b) => (await socialStore.pair(a, b))?.status === 'accepted',
          tableMembers: (id, code) => tableRef.svc?.memberIds(id, code) ?? null,
          rules: () => chatRulesFromSettings(settings),
          filter: words,
        })
      : undefined;
  const live: { matches?: MatchService; queue?: DuelQueue; teamQueue?: DuelQueue } = {};
  const botStore = db ? createDbBotPlayerStore(db) : undefined;
  const botService =
    botStore && player && settings
      ? new BotPlayerService(botStore, () => rulesFromSettings(settings, levelTable ? () => levelTable.get() : undefined).then((r) => r.xp), () => randomInt(0, 2 ** 30) / 2 ** 30, async (id) => player.afterGame?.(id))
      : undefined;
  const botDriver =
    botStore && settings
      ? new BotDriver({
          store: botStore,
          matches: () => live.matches,
          queue: () => live.queue,
          teamQueue: () => live.teamQueue,
          chat: () => chat,
          settings: async () => ({ enabled: (await settings.num('bots.enabled')) === 1, fallbackSec: await settings.num('bots.fallback_seconds'), jitterSec: await settings.num('bots.fallback_jitter_seconds'), cityReplyPercent: await settings.num('bots.city_reply_percent'), autofillMin: await settings.num('bots.autofill_min') }),
          topUp: botService ? async (missing) => void (await botService.generate({ count: missing, levelMin: 3, levelMax: 25, skillMin: 30, skillMax: 75, winPercentMin: 40, winPercentMax: 65, thinkMinMs: 4000, thinkMaxMs: 20_000, tauntPercent: 25, cityIds: playerStore ? (await playerStore.cities()).map((c) => c.id) : [] })) : undefined,
          taunts: chatStore ? async () => (await chatStore.taunts()).filter((c) => c.ageTrack === 'adult').map((c) => ({ nameFa: c.nameFa, ids: c.taunts.map((t) => t.id) })) : undefined,
          rng: () => randomInt(0, 2 ** 30) / 2 ** 30,
        })
      : undefined;
  if (chat && botDriver) chat.onCityMessage = (cityId, message) => void botDriver.onCityMessage(cityId, message);
  const sponsorStore = db ? createDbSponsorStore(db) : undefined;
  const tournamentService =
    db && settings && player && socialStore
      ? new TournamentService(createDbTournamentStore(db), {
          levelOf: async (id) => (await player.levelOf(id)).level.level,
          profileOf: async (id) => socialStore.publicRow(id),
          sponsorOf: async (id) => (await sponsorStore?.get(id)) ?? null,
          startMatch: async (a, b) => (live.matches ? live.matches.start(a, b, { friendly: true }) : false),
          inMatch: (id) => live.matches?.inMatch(id) ?? false,
          fillBots: (n) => botDriver?.fillSeats(n) ?? [],
          isBot: (id) => botDriver?.isBot(id) ?? false,
          notify: (id, text) => void notify?.notify(id, 'admin', text).catch(() => undefined),
        })
      : undefined;
  const wheelStore = db ? createDbWheelStore(db) : undefined;
  const wheel =
    db && settings && wheelStore
      ? new WheelService(wheelStore, async () => {
          // The live table (admin-edited); a slice with no odds never shows. An empty table falls back to the shared default.
          const live = (await wheelStore.prizes()).filter((p) => p.weight > 0 && (p.kind !== 'cosmetic' || p.itemId)).map((p) => ({ kind: p.kind, amount: p.amount, weight: p.weight, itemId: p.itemId ?? undefined, iconKey: p.iconKey, titleFa: p.titleFa ?? undefined }));
          return {
            enabled: (await settings.num('wheel.enabled')) === 1,
            slices: scaleSlices(live.length > 0 ? live : WHEEL_SLICES_DEFAULT, await settings.num('wheel.prize_scale_percent')),
            dailySpins: await settings.num('wheel.daily_spins'),
            winSpins: (await settings.num('wheel.win_spins')) === 1,
            refillHours: await settings.num('wheel.refill_hours'),
            refillCap: await settings.num('wheel.refill_cap'),
            dupeCoins: await settings.num('wheel.cosmetic_dupe_coins'),
          };
        }, () => randomInt(0, 2 ** 32) / 2 ** 32)
      : undefined;
  const birthday =
    db && settings && socialStore
      ? new BirthdayService({
          store: createDbBirthdayStore(db),
          rules: async () => {
            const [minAge, before, length, coins, gems, spins] = await Promise.all(['birthday.min_age', 'birthday.week_before_days', 'birthday.week_days', 'birthday.gift_coins', 'birthday.gift_gems', 'birthday.gift_spins'].map((k) => settings.num(k)));
            return { minAge: minAge!, before: before!, length: length!, coins: coins!, gems: gems!, spins: spins! };
          },
          friendsOf: async (id) => (await socialStore.friends(id)).map((f) => f.id),
          giveSpins: (id, ref, n) => wheel?.give(id, 'birthday', ref, n) ?? Promise.resolve(0),
          tell: (ids, title, body) => messages?.tellUsers(ids, title, body) ?? Promise.resolve(),
          texts: { weekTitle: BIRTHDAY_TITLE.week, weekBody: BALE_TEXT.birthdayWeek, dayTitle: BIRTHDAY_TITLE.day, dayBody: BALE_TEXT.birthdayDay },
        })
      : undefined;
  const guardianStore = db ? createDbGuardianStore(db) : undefined;
  const guardianSettings = db ? new GuardianSettingsService(createDbGuardianSettingsStore(db)) : undefined;
  const ageTracks = db && settings ? new AgeTrackService(createDbAgeTrackStore(db), async () => (await settings.num('feature.age_tracks')) === 1, () => new Date(), async (id) => (guardianStore ? (await guardianStore.guardianOf(id)) !== null : false), async (id) => (guardianStore && guardianSettings && (await guardianStore.guardianOf(id)) !== null ? guardianSettings.limits(id) : null)) : undefined;
  const guardian =
    db && auth && phoneLogin
      ? new GuardianService(createDbGuardianStore(db), createDbAgeTrackStore(db), phoneLogin, createDbPhoneStore(db), auth, () => `guardian:${randomUUID()}`)
      : undefined;
  const productAdmin = db ? createDbProductAdmin(db) : undefined;
  const feedback = db && settings && productAdmin ? buildFeedbackService({ db, settings, productAdmin, player, socialStore }) : undefined;
  const duelStakes =
    db && settings
      ? new DuelStakes(createDbStakeStore(db), {
          rules: async () => ({
            entryFee: await settings.num('duel.entry_fee'),
            houseCutPercent: await settings.num('duel.house_cut_percent'),
            freePerDay: await settings.num('duel.free_per_day'),
            freePayoutPercent: await settings.num('duel.free_payout_percent'),
            consolation: await settings.num('duel.loss_consolation'),
            consolationCap: await settings.num('duel.consolation_cap'),
            rescueTarget: await settings.num('duel.rescue_target'),
          }),
          isBot: (id) => botDriver?.isBot(id) ?? false,
          priceWager: () => settings.num('duel.price_wager'),
          onWin: (matchId, userId) => wheel?.grantForWin(userId, matchId).catch((e) => console.error('[wheel] grant failed', matchId, e)) ?? Promise.resolve(),
        })
      : undefined;
  const tableService =
    settings && socialStore
      ? new TableService({
          profileOf: async (id) => socialStore.publicRow(id),
          startMatch: async (a, b) => (live.matches ? live.matches.start(a, b, { friendly: true }) : false),
          startTeam: async (sides) => (live.matches ? live.matches.startTeam(sides) : false),
          inMatch: (id) => live.matches?.inMatch(id) ?? false,
          trackOf: ageTracks ? (id) => ageTracks.effective(id) : undefined,
          socialBlocked: ageTracks ? (id) => ageTracks.socialBlocked(id) : undefined,
          duelsOff: ageTracks ? (id) => ageTracks.duelsOff(id) : undefined,
          idleMs: async () => (await settings.num('table.idle_minutes')) * 60_000,
        })
      : undefined;
  tableRef.svc = tableService;
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
          Date.now,
          ageTracks ? (me, others) => ageTracks.meetable(me, others) : undefined,
          ageTracks ? (id) => ageTracks.socialBlocked(id) : undefined,
          ageTracks ? (id) => ageTracks.friendsNeedApproval(id) : undefined,
        )
      : undefined;
  if (chat && ageTracks) chat.managed = { trackOf: (id) => ageTracks.effective(id), hasGuardian: async (id) => (guardianStore ? (await guardianStore.guardianOf(id)) !== null : false), chatMode: async (id) => (guardianSettings ? (await guardianSettings.get(id)).chatMode : 'friends_text') };
  if (social && ageTracks) {
    social.sameTrack = (me, others) => ageTracks.meetable(me, others);
    social.blocked = (id) => ageTracks.socialBlocked(id);
    social.asksGuardian = (id) => ageTracks.friendsNeedApproval(id);
  }
  if (guardian && guardianSettings) guardian.settings = guardianSettings;
  if (guardian && social && socialStore) {
    guardian.friends = {
      friends: (id) => socialStore.friends(id),
      incoming: (id) => socialStore.incoming(id),
      approve: (childId, otherId) => social.approveFor(childId, otherId),
      remove: (childId, otherId) => social.remove(childId, otherId),
    };
  }
  const levelOf = async (id: string) => (player ? (await player.levelOf(id)).level.level : 1);
  const shopStore = db ? createDbShopStore(db) : undefined;
  const landingService = db ? new LandingService(createDbLandingStore(db)) : undefined;
  const shortLinkService = db && settings ? new ShortLinkService(createDbShortLinkStore(db), () => settings.text('domain.short')) : undefined;
  if (social && shopStore) {
    const wardrobe = new ShopService(shopStore, levelOf);
    social.wornOf = (id) => wardrobe.worn(id);
  }
  const shopReal = shopStore ? new ShopRealMoney(shopStore, levelOf) : undefined;
  const coinPackageService = db ? new CoinPackageService(createDbCoinPackageStore(db), levelOf) : undefined;
  if (notify && coinPackageService) {
    // Coins bought with the Bale wallet: the bot judges the pre-checkout and credits the successful payment (docs/logic/bale-payments.md).
    // `si:` payloads are shop items bought for money (D170), `cp:` payloads are coin packages.
    notify.payments = {
      preCheckout: (payload, amount, currency, payer) => (payload.startsWith('si:') && shopReal ? shopReal.preCheckout(payload, amount, currency, payer) : coinPackageService.preCheckout(payload, amount, currency, payer)),
      creditPaid: (payload, chargeId, amount) => (payload.startsWith('si:') && shopReal ? shopReal.creditPaid(payload, chargeId, amount) : coinPackageService.creditPaid(payload, chargeId, amount)),
    };
    notify.providerToken = process.env.BALE_PROVIDER_TOKEN ?? null;
  }
  let dailyRef: DailyService | undefined;
  const solo =
    db && settings
      ? new SoloService(createDbPuzzleSource(db), {
          rules: () => soloRules(settings),
          levelOf,
          trackOf: ageTracks ? (id) => ageTracks.effective(id) : undefined,
          onFinished: (id, outcome, tag) => {
            void player?.recordGame(id, { mode: 'solo', outcome });
            void dailyRef?.onFinished(id, outcome, tag).catch((err) => console.error('daily finish failed', err));
          },
        })
      : undefined;
  const priceOnly =
    db && settings
      ? new PriceOnlyService(createDbPriceOnlySource(db), {
          rules: async () => {
            const r = await soloRules(settings);
            return { rounds: await settings.num('priceonly.rounds'), tiers: r.tiers, minPoints: r.minPoints };
          },
        })
      : undefined;
  const dailyStore = db ? createDbDailyStore(db) : undefined;
  const daily = dailyStore && solo && settings ? new DailyService(dailyStore, solo, { num: (k) => settings.num(k) }) : undefined;
  dailyRef = daily;
  const botRepo = db ? createDbBotRepository(db) : undefined;
  const bot = botRepo ? new BotService(botRepo) : undefined;
  const reportError = createErrorReporter({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV, release: process.env.APP_RELEASE });
  const app = buildServer({
    reportError,
    auth,
    settings,
    adminModules: db
      ? { products: productAdmin!, feedback, stats: createDbStatsAdmin(db), users: createDbUsersAdmin(db), audit: createDbAuditLog(db), words, cities: playerStore, shop: shopStore, wheel, landing: landingService, shortLinks: shortLinkService && settings ? { service: shortLinkService, base: async () => { const h = (await settings.text('domain.short')).trim(); return h ? `https://${h}` : ''; } } : undefined, coinPackages: coinPackageService, invites: inviteStore, badges: badgeStore && badges ? { store: badgeStore, service: badges } : undefined, chat: chatStore, tournaments: tournamentService, sponsors: sponsorStore, lessons: db ? createDbLessonStore(db) : undefined, ageTracks: db ? createDbAgeTrackAdmin(db) : undefined, daily, puzzles: createDbPuzzleAdmin(db), levelRoad: levelTable && settings ? { table: levelTable, defaults: async () => { const [curveBase, levelMax, every, base] = await Promise.all(['xp.curve_base', 'xp.level_max', 'levelreward.every', 'levelreward.base_coins'].map((k) => settings.num(k))); return defaultLevelTable({ curveBase: curveBase!, levelMax: levelMax! }, { every: every!, base: base! }); } } : undefined, botPlayers: botStore && player && settings && botService ? { service: botService, cities: async () => (playerStore ? (await playerStore.cities()).map((c) => c.id) : []) } : undefined, messages, bale: notify && baleStore ? { service: notify, store: baleStore, botUsername: baleUsername } : undefined, bot: botRepo && bot ? { repo: botRepo, service: bot } : undefined }
      : undefined,
    realtime: Boolean(auth),
    match: db
      ? {
          puzzles: createDbPuzzleSource(db),
          trackOf: ageTracks ? (id) => ageTracks.effective(id) : undefined,
          teamBoards: settings ? () => settings.num('match.team_boards') : undefined,
          priceRound: settings ? async () => (await settings.num('match.price_round')) === 1 : undefined,
          rules: settings
            ? async () => {
                const [turnSeconds, maxMistakes, maxTimeouts, groupPoints, firstBloodBonus] = await Promise.all([settings.num('game.turn_seconds'), settings.num('game.match_max_mistakes'), settings.num('game.max_consecutive_timeouts'), settings.list('score.group_points'), settings.num('score.first_blood_bonus')]);
                return { turnSeconds, maxMistakes, maxTimeouts, groupPoints, firstBloodBonus };
              }
            : undefined,
          stakes: duelStakes,
          profile: (() => {
            const base = createDbProfileLookup(db, player ? async (id) => (await player.levelOf(id)).level.level : undefined);
            return async (id: string) => {
              const p = await base(id);
              if (!p) return p;
              const party = await birthday?.info([id]);
              return party?.get(id)?.badge ? { ...p, birthday: true } : p;
            };
          })(),
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
    phoneLogin,
    find,
    deletion,
    ledger: db ? createDbLedgerReader(db) : undefined,
    badges,
    chat,
    tournaments: tournamentService,
    daily,
    live,
    botDriver,
    presence,
    notices,
    notify,
    messages,
    social,
    invite,
    transfers,
    wheel,
    dailyReward: db && settings ? new DailyRewardService(createDbDailyRewardStore(db), Date.now, () => dailyRules(settings)) : undefined,
    catalog: db ? createDbCatalogRepository(db) : undefined,
    solo,
    priceOnly,
    duelLevelGate: settings && player ? async (id) => (await player.levelOf(id)).level.level >= (await settings.num('duel.min_level')) : undefined,
    tables: tableService,
    duelStakes,
    limiter: db && settings ? new PlayLimiter(createDbPlayCountStore(db), async (mode) => settings.num(mode === 'solo' ? 'limit.solo_per_day' : 'limit.duel_per_day')) : undefined,
    hints: solo && shopStore && settings ? new HintService(solo, shopStore, () => hintRules(settings), levelOf) : undefined,
    shop: shopStore ? new ShopService(shopStore, levelOf) : undefined,
    levelRoad:
      player && settings
        ? new LevelRoadService({
            levelOf: async (id) => (await player.levelOf(id)).level,
            xpRules: async () => (await rulesFromSettings(settings, levelTable ? () => levelTable.get() : undefined)).xp,
            table: levelTable ? () => levelTable.get() : undefined,
            gates: async () => {
              const get = async (key: string) => (await settings.num(key)) ?? undefined;
              const [hint, invite, transfer, avatar, nickname, duel] = await Promise.all(['hint.min_level', 'invite.min_level', 'transfer.min_level', 'profile.avatar_change_min_level', 'profile.nickname_change_min_level', 'duel.min_level'].map(get));
              return { hint, invite, transfer, avatar, nickname, duel };
            },
            shopItems: async () => (shopStore ? shopStore.items() : []),
            rewardRules: async () => ({ every: await settings.num('levelreward.every'), base: await settings.num('levelreward.base_coins') }),
            claimedLevels: (id) => (db ? createDbRewardStore(db).claimedLevels(id) : Promise.resolve([])),
            payRewards: (id, rewards) => (db ? createDbRewardStore(db).payRewards(id, rewards) : Promise.resolve({ paid: [], balance: 0 })),
          })
        : undefined,
    gems: db ? createDbGemWallet(db) : undefined,
    birthday,
    ageTracks,
    lessons: db ? createDbLessonStore(db) : undefined,
    guardian,
    feedback,
    profileTasks:
      db && settings
        ? new ProfileTaskService({
            ...createDbProfileTaskStore(db),
            coins: async () => {
              const entries = await Promise.all(MISSION_KEYS.map(async (k) => [k, (await settings.num(`profiletask.coins_${k}`)) ?? 0] as const));
              return Object.fromEntries(entries) as Record<MissionKey, number>;
            },
          })
        : undefined,
    coinPackages: coinPackageService,
    shopReal,
    shortLinks: shortLinkService,
    landing: landingService,
    clientInfo: db ? createDbClientInfoStore(db) : undefined,
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
  if (birthday) {
    // Friend messages for a birthday week and the day itself: checked every 2 hours, the log makes a repeat harmless.
    const run = () => void birthday.announce().catch((err) => app.log.error({ err }, 'birthday announce failed'));
    const timer = setInterval(run, 2 * 3_600_000);
    timer.unref();
    setTimeout(run, 30_000).unref();
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
  if (db && settings && process.env.PUZZLE_SCHEDULER !== 'off') {
    const pool = startPuzzlePoolScheduler({ admin: createDbPuzzleAdmin(db), settings, rng: () => randomInt(0, 2 ** 30) / 2 ** 30, log: (msg, err) => (err ? app.log.error({ err }, msg) : app.log.info(msg)) });
    app.addHook('onClose', async () => pool.stop());
  }
  if (notify && baleClient) {
    const runner = startNotifyRunner({ service: notify, client: baleClient, settings, log: (msg, err) => (err ? app.log.error({ err }, msg) : app.log.info(msg)) });
    app.addHook('onClose', async () => runner.stop());
  }
  // The default shop items, badges, taunts and cities are created on first read; read them once now so a fresh database is complete at boot.
  if (db) {
    void Promise.all([shopStore?.items({ includeHidden: true }), badgeStore?.catalog({ includeHidden: true }), chatStore?.taunts({ includeHidden: true }), playerStore?.cities()]).then(
      ([shop, badgeRows, taunts, cities]) => app.log.info(`defaults ready: ${shop?.length ?? 0} shop items, ${badgeRows?.length ?? 0} badges, ${taunts?.length ?? 0} taunt categories, ${cities?.length ?? 0} cities`),
      (err) => app.log.warn({ err }, 'could not prepare default content'),
    );
  }
  const port = Number(process.env.PORT ?? 3000);
  process.on('unhandledRejection', (err) => (app.log.error({ err }, 'unhandled rejection'), reportError(err, 'unhandledRejection')));
  process.on('uncaughtException', (err) => (app.log.error({ err }, 'uncaught exception'), reportError(err, 'uncaughtException')));
  app.listen({ port, host: '0.0.0.0' }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
