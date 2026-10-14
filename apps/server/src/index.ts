import { registerPendingRoutes } from './notify/pending.js';
import { randomInt, randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { resolve } from 'node:path';
import { AVATAR_CHANGE_MIN_LEVEL, AVATAR_UNLOCK_GAMES, duelTiers, rialsToTomanString, pickTriviaQuestions, shuffleTrivia } from '@dozari/shared';
import { CHAT_RETENTION_DAYS, trackRules, MISSION_KEYS, TOURNAMENT_TICK_SECONDS, dailyDateKey, trackFeatureForPath, trackRuleForPath, WHEEL_SLICES_DEFAULT, scaleSlices } from '@dozari/shared';
import type { AgeTrack, HintRules, MissionKey } from '@dozari/shared';
import { createDb, imageStoreFromEnv } from '@dozari/db';
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
import { defaultLevelTable, todayInTehran } from '@dozari/shared';
import { createDbPlayerStore } from './player/store.js';
import { registerTransferRoutes } from './transfers/routes.js';
import { registerKeepsakeRoutes } from './keepsakes/routes.js';
import { KeepsakeService } from './keepsakes/service.js';
import { createDbKeepsakeStore } from './keepsakes/store.js';
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
import { AmbientLobby } from './tables/ambient.js';
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
import { withSmsLogging } from './phone/sms.js';
import type { SmsClient } from './phone/sms.js';
import { SmsGateway } from './phone/smsConfig.js';
import { createDbPhoneStore } from './phone/store.js';
import { PuzzleHistory } from './solo/history.js';
import { registerInviteRoutes } from './invite/routes.js';
import { InviteService, inviteRulesFromSettings } from './invite/service.js';
import { createDbInviteStore } from './invite/store.js';
import { registerCandidateRoutes } from './realtime/candidates.js';
import { createDbProfileLookup } from './realtime/profile.js';
import { AccountDeletion, createDbDeleteCodeStore } from './account/deletion.js';
import { registerAuthRoutes } from './auth/routes.js';
import type { MiniAppTokens } from './auth/routes.js';
import { miniAppDeviceId } from './auth/miniapp.js';
import { createTokenSigner } from './auth/tokens.js';
import { createDbAdminRepository } from './admin/db-repository.js';
import { registerAdminRoutes } from './admin/routes.js';
import type { AdminModules } from './admin/module-routes.js';
import { AdminAccounts } from './admin/accounts/service.js';
import { createDbAdminStore } from './admin/accounts/store.js';
import { createDbAuditLog } from './admin/audit.js';
import { createDbEconomyAdmin } from './admin/economy.js';
import { createDbProductAdmin } from './admin/products.js';
import { createDbCategoryAdmin } from './admin/categories.js';
import { createDbStatsAdmin } from './admin/stats.js';
import { createDbUsersAdmin } from './admin/users.js';
import { createDbBotRepository } from './bot/repository.js';
import { BotService } from './bot/service.js';
import { startBotScheduler } from './bot/scheduler.js';
import { TextFilterService, createDbWordStore } from './textfilter/service.js';
import { createBaleClient } from './notify/client.js';
import { NotifyService } from './notify/service.js';
import { createBaleSignup } from './notify/signup.js';
import { startNotifyRunner } from './notify/runner.js';
import { registerBaleRoutes } from './notify/routes.js';
import { FcmService, createDbFcmTokenStore, createFcmSender, loadServiceAccount, registerFcmRoutes } from './notify/fcm.js';
import { WebPushService, createDbPushSubStore, createVapidSender, registerWebPushRoutes } from './notify/webpush.js';
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
import { AiStudio } from './ai/studio.js';
import { AiScheduler, createDbAiScheduleStore, startAiScheduler } from './ai/schedules.js';
import { startPuzzlePoolScheduler } from './puzzles/pool.js';
import { createSecretBox } from './backup/crypto.js';
import { createMysqldumpDumper, parseDatabaseUrl } from './backup/dump.js';
import { BackupService, startBackupScheduler } from './backup/service.js';
import { createS3Storage } from './backup/storage.js';
import { createDbBackupStore } from './backup/store.js';
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
import { createDbGemWallet, createGemCardPayer, registerGemRoutes } from './economy/gems.js';
import type { GemWalletReader } from './economy/gems.js';
import { createDbProfileTaskStore } from './profile/tasks-store.js';
import { BirthdayService, registerBirthdayRoutes } from './profile/birthday.js';
import { AvatarService, registerAvatarRoutes } from './profile/avatars.js';
import { createDbAvatarStore } from './profile/avatars-store.js';
import type { AvatarStore } from './profile/avatars-store.js';
import { createErrorReporter } from './errors/report.js';
import { buildFeedbackService } from './feedback/build.js';
import { applyLedgerEntry } from './economy/ledger.js';
import type { FeedbackService } from './feedback/service.js';
import { registerFeedbackRoutes } from './feedback/routes.js';
import { registerClientErrorRoutes } from './clienterrors/routes.js';
import { createDbClientErrorStore } from './clienterrors/store.js';
import type { ClientErrorStore } from './clienterrors/store.js';
import { createDbBirthdayStore } from './profile/birthday-store.js';
import { AgeTrackService, registerAgeTrackRoutes } from './agetrack/service.js';
import { createDbAgeTrackStore } from './agetrack/store.js';
import { createDbAgeTrackAdmin } from './agetrack/overview.js';
import { GuardianService, registerGuardianRoutes } from './guardian/service.js';
import { createDbGuardianStore } from './guardian/store.js';
import { GuardianSettingsService, createDbGuardianSettingsStore } from './guardian/settings.js';
import { createDigestBuilder } from './guardian/digest.js';
import { PlayTimeService, createDbGuardianBlockStore, createDbPlayTimeStore } from './guardian/extras.js';
import { createDbLessonSeenStore } from './lessons/seen.js';
import type { LessonSeenStore } from './lessons/seen.js';
import { registerLessonRoutes } from './lessons/service.js';
import type { LessonStore } from './lessons/service.js';
import { createDbLessonStore } from './lessons/store.js';
import { ShopService } from './economy/shop.js';
import { createDbShopStore } from './economy/shop-store.js';
import { HintService } from './solo/hints.js';
import { PlayLimiter, createDbPlayCountStore } from './limits/play-limits.js';
import { LeaveService, createDbLeaveStore, leaveRulesFromSettings } from './leaves/service.js';
import { registerLeaveRoutes } from './leaves/routes.js';
import { DuelStakes } from './duel/stakes.js';
import { registerAdsRoutes } from './ads/routes.js';
import { AdsService } from './ads/service.js';
import { createDbAdsStore } from './ads/store.js';
import { registerWheelRoutes } from './wheel/routes.js';
import { WheelService } from './wheel/service.js';
import { createDbWheelStore } from './wheel/store.js';
import { createDbStakeStore } from './duel/stakes-store.js';
import { TableService } from './tables/service.js';
import { TableStakes } from './tables/stakes.js';
import { registerTableRoutes } from './tables/routes.js';
import { currentUser } from './auth/routes.js';
import { registerSoloRoutes } from './solo/routes.js';
import { registerPriceOnlyRoutes } from './priceonly/routes.js';
import { TriviaService } from './trivia/service.js';
import { registerTriviaRoutes } from './trivia/routes.js';
import { createDbTriviaStore } from './trivia/store.js';
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
  /** Active product categories for the lookup screen's filter chips. */
  categories?: () => Promise<{ slug: string; nameFa: string }[]>;
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
  /** Rewarded video ads (`/ads`, and the admin placement table). */
  ads?: AdsService;
  /** Socket.io service (queue, matches); needs `auth`. Its live stats feed the admin panel. */
  realtime?: boolean;
  /** Bale messenger integration: link codes for players, the bot's name for the app. */
  bale?: { service: NotifyService; botUsername: string | null };
  webPush?: WebPushService;
  fcm?: FcmService;
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
  ambientLobby?: AmbientLobby;
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
  /** The keepsake collection («گنجینه»): `/keepsakes`, the profile showcase, and the piece a human win may drop. */
  keepsakes?: KeepsakeService;
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
  /** A player's level (the stake tables of the live queue are level-gated). */
  levelOf?: (userId: string) => Promise<number>;
  /** Price-only games (`/price-only/*`). */
  priceOnly?: PriceOnlyService;
  /** General four-choice questions (docs/logic/trivia.md), and the tracks a player may draw questions from. */
  trivia?: { service: TriviaService; tracksOf?: (userId: string | undefined) => Promise<readonly AgeTrack[]> };
  /** Paid hints of solo games; needs `solo` and `auth`. */
  hints?: HintService;
  /** Private tables (`/tables`); needs `auth` and the live-match service. */
  tables?: TableService;
  /** Coin stakes of queue duels (entry, payout, free matches, rescue). */
  duelStakes?: DuelStakes;
  /** Admin-set daily game caps (solo, live duel). */
  limiter?: PlayLimiter;
  /** The leave penalty (day ban, monthly badge); absent = no penalty. */
  leaves?: LeaveService;
  /** Coin shop (`/shop`); needs `auth`. */
  shop?: ShopService;
  /** Level road (`/me/levels`, D109); needs `auth`. */
  levelRoad?: LevelRoadService;
  profileTasks?: ProfileTaskService;
  /** The avatar («شخصیت») shelf: free and priced avatars (`/me/avatars`, D219); needs `auth`. */
  avatars?: AvatarService;
  /** Birth date, birthday week, yearly gift and friend messages (D160). */
  birthday?: BirthdayService;
  /** Chosen age track: kid / teen / adult (D198); queues only pair one track. */
  ageTracks?: AgeTrackService;
  /** Minutes in the app per day (the app's heartbeat), for the guardian's reminder and digest. */
  playTime?: PlayTimeService;
  /** May this player preview the kid and teen space (a guardian with at least one child)? */
  canPreview?: (userId: string) => Promise<boolean>;
  /** Kid word lessons (D198). */
  lessons?: LessonStore;
  /** Which word lessons a player saw (the guardian's digest). */
  lessonSeen?: LessonSeenStore;
  /** Guardian links: child profiles, link codes, band-change approval (D198). */
  guardian?: GuardianService;
  /** Reports of players and the suggestion / vote / approve loop (D177). */
  feedback?: FeedbackService;
  /** Errors the app reports with a screenshot (`POST /client-errors`, docs/logic/client-errors.md). */
  clientErrors?: ClientErrorStore;
  gems?: Pick<GemWalletReader, 'wallet'>;
  /** Coin packages bought with real money (`/coin-packages`, off by default); needs `auth`. */
  coinPackages?: CoinPackageService;
  /** Shop items bought with real money (`/shop-pay`, behind the same switch as coin packages). */
  shopReal?: ShopRealMoney;
  /** Allowed browser origins (e.g. Expo web dev). `*` allows any. Off when unset: native apps don't need CORS. */
  corsOrigin?: string;
  /** Docker-free dev: directory of uploaded product images, served at `/images/*`. */
  localImagesDir?: string;
  /** Bot tokens per messenger; turns on `POST /auth/miniapp` (the mini-app login, docs/logic/miniapp.md). */
  miniApp?: MiniAppTokens;
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
    if (deps.auth && deps.ageTracks) {
      // What a kid or teen track does not have is refused here too (the app only hides it): real-money buying, suggesting items, tournaments, the daily puzzle, the price lookup.
      const rule = trackRuleForPath(req.url.split('?')[0] ?? '');
      if (rule) {
        const user = await currentUser(deps.auth, req);
        if (user && !(await deps.ageTracks.allows(user.id, rule))) return reply.code(403).send({ error: 'age_track' });
      }
      // The admin's per-track kill switches (`track.kid.chat` …): a switched-off feature answers the same way.
      const feature = trackFeatureForPath(req.url.split('?')[0] ?? '');
      if (feature) {
        const user = await currentUser(deps.auth, req);
        if (user && (await deps.ageTracks.featureOff(user.id, feature))) return reply.code(403).send({ error: 'age_track' });
      }
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

  // A messenger's web client may open the mini-app in a sandboxed iframe, whose requests carry `Origin: null`. The API takes bearer tokens
  // only (no cookies), so allowing that origin adds no cross-site risk; it is on only when a mini-app login is.
  const corsOrigin = deps.corsOrigin && (deps.miniApp?.bale || deps.miniApp?.telegram) && deps.corsOrigin !== '*' && !deps.corsOrigin.split(',').some((o) => o.trim() === 'null') ? `${deps.corsOrigin},null` : deps.corsOrigin;
  if (corsOrigin) {
    // @fastify/cors ≥10 allows only GET/HEAD/POST by default; the web app also sends PUT, PATCH and DELETE.
    void app.register(fastifyCors, { origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()), methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'] });
  }
  if (deps.auth) registerAuthRoutes(app, deps.auth, deps.deletion, deps.miniApp);
  if (deps.auth && deps.dailyReward) registerDailyRewardRoutes(app, deps.auth, deps.dailyReward);
  if (deps.auth && deps.wheel) registerWheelRoutes(app, deps.auth, deps.wheel);
  if (deps.auth && deps.ads) registerAdsRoutes(app, deps.auth, deps.ads);
  if (deps.auth && deps.social) registerSocialRoutes(app, deps.auth, deps.social);
  if (deps.auth && deps.invite) registerInviteRoutes(app, deps.auth, deps.invite);
  if (deps.auth && deps.transfers) registerTransferRoutes(app, deps.auth, deps.transfers);
  if (deps.auth && deps.keepsakes) registerKeepsakeRoutes(app, deps.auth, deps.keepsakes);
  if (deps.auth && deps.webPush) registerWebPushRoutes(app, deps.auth, deps.webPush);
  if (deps.auth && deps.fcm) registerFcmRoutes(app, deps.auth, deps.fcm);
  if (deps.auth && deps.messages) registerInboxRoutes(app, deps.auth, deps.messages);
  if (deps.auth && deps.messages && deps.social) {
    const center = deps.messages;
    const social = deps.social;
    registerPendingRoutes(app, deps.auth, { inbox: (id) => center.inbox(id), incomingRequests: async (id) => (await social.friends(id)).incoming.map((p) => ({ id: p.id, nickname: p.nickname })) });
  }
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
    registerLookupRoutes(app, deps.catalog, deps.categories);
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
    // A live nudge on top of the chat card, so the friend sees «X invited you» wherever they are in the app.
    deps.notices?.push(friendId, { kind: 'table_invite', from: r.message.nickname, code: t.code });
    if (!online) void deps.notify?.notify(friendId, 'table_invite', BALE_TEXT.tableInvite(r.message.nickname)).catch(() => undefined);
    return { ok: true, online };
  } : undefined, (playerId) => deps.live?.matches?.spectate(playerId) ?? null);
  if (deps.solo) registerSoloRoutes(app, deps.solo, deps.auth, deps.hints, deps.limiter, deps.canPreview);
  if (deps.priceOnly) registerPriceOnlyRoutes(app, deps.priceOnly, deps.auth);
  if (deps.auth && deps.leaves) registerLeaveRoutes(app, deps.leaves, deps.auth);
  if (deps.trivia) registerTriviaRoutes(app, deps.trivia.service, deps.auth, deps.trivia.tracksOf);
  if (deps.auth && deps.shop) registerShopRoutes(app, deps.auth, deps.shop);
  if (deps.auth && deps.levelRoad) registerRoadRoutes(app, deps.auth, deps.levelRoad);
  if (deps.auth && deps.profileTasks) registerProfileTaskRoutes(app, deps.auth, deps.profileTasks);
  if (deps.auth && deps.avatars) registerAvatarRoutes(app, deps.auth, deps.avatars);
  if (deps.auth && deps.birthday) registerBirthdayRoutes(app, deps.auth, deps.birthday);
  if (deps.auth && deps.ageTracks) registerAgeTrackRoutes(app, deps.auth, deps.ageTracks, deps.playTime);
  if (deps.auth && deps.lessons) registerLessonRoutes(app, deps.auth, deps.lessons, deps.lessonSeen);
  if (deps.auth && deps.guardian) registerGuardianRoutes(app, deps.auth, deps.guardian);
  if (deps.auth && deps.feedback) registerFeedbackRoutes(app, deps.auth, deps.feedback);
  if (deps.clientErrors) registerClientErrorRoutes(app, deps.clientErrors, deps.auth);
  if (deps.auth && deps.gems) registerGemRoutes(app, deps.auth, deps.gems);
  if (deps.landing && deps.settings) registerLandingPublicRoutes(app, deps.landing, deps.settings);
  if (deps.shortLinks) registerShortLinkRoutes(app, deps.shortLinks);
  if (deps.auth && deps.shopReal) registerShopPayRoutes(app, deps.auth, deps.shopReal, deps.notify ? { send: (id, inv) => deps.notify!.sendInvoice(id, inv), link: (inv) => deps.notify!.invoiceLink(inv) } : undefined);
  if (deps.auth && deps.coinPackages) registerCoinPackageRoutes(app, deps.auth, deps.coinPackages, deps.notify ? { send: (id, inv) => deps.notify!.sendInvoice(id, inv), link: (inv) => deps.notify!.invoiceLink(inv) } : undefined);
  let gateway: Gateway | undefined;
  if (deps.auth && deps.realtime) {
    const auth = deps.auth;
    gateway = attachGateway(app.server, { banned: deps.leaves ? (u) => deps.leaves!.isBanned(u) : undefined, graceMs: deps.settings ? async () => (await deps.settings!.num('leave.grace_seconds')) * 1000 : undefined, onLeft: deps.tables ? (u) => void deps.tables!.leave(u) : undefined, authenticate: (t) => auth.authenticate(t), corsOrigin, match: deps.match, canAfford: deps.duelStakes ? async (u, tier) => (deps.ageTracks && !(await deps.ageTracks.allows(u, 'coinWager'))) || deps.duelStakes!.canQueue(u, tier) : undefined, tierGate: deps.duelStakes && deps.levelOf ? async (u, tier) => { if (deps.ageTracks && !(await deps.ageTracks.allows(u, 'coinWager'))) return 'UNKNOWN_TIER'; const t = (await deps.duelStakes!.tiers()).find((x) => x.id === tier); if (!t) return 'UNKNOWN_TIER'; return (await deps.levelOf!(u)) >= t.minLevel ? null : 'LEVEL_TOO_LOW'; } : undefined, gate: deps.settings ? () => gateForDuel(deps.settings!) : undefined, levelGate: deps.duelLevelGate, limit: deps.limiter ? { canPlay: async (u) => (await deps.limiter!.check(u, 'duel')).ok, onStarted: (u) => deps.limiter!.record(u, 'duel') } : undefined, chat: deps.chat, presence: deps.presence, notices: deps.notices, onEmit: deps.botDriver ? (u, e, p) => deps.botDriver!.onEmit(u, e, p) : undefined, trackOf: deps.ageTracks ? (u) => deps.ageTracks!.effective(u).catch(() => 'adult' as const) : undefined, trackGate: deps.ageTracks ? (u) => deps.ageTracks!.featureOff(u, 'duel_queue') : undefined, diagnose: deps.match ? createQueueDiagnosis({ hasPuzzle: async (tracks) => (await deps.match!.puzzles.pickRandom({ tracks })) !== null, botsReady: () => deps.botDriver?.ready() ?? false, graceSec: 45 }) : undefined });
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

/** The panel's upload target: S3 when `S3_ENDPOINT` is set, else the local images dir; off when neither is configured. */
function adminImageStore() {
  if (!process.env.S3_ENDPOINT && !process.env.LOCAL_IMAGES_DIR) return undefined;
  return imageStoreFromEnv();
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

/** The gem-card chance and prize (admin settings `gemcard.*`). */
async function gemCardRules(settings: SettingsService): Promise<{ percent: number; amount: number }> {
  const [percent, amount] = await Promise.all([settings.num('gemcard.percent'), settings.num('gemcard.amount')]);
  return { percent, amount };
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
  // The signup faucet (docs/logic/economy.md): once per new account; the key makes a retry a no-op.
  const grantSignupBonus = async (userId: string) => {
    const bonus = (await settings?.num('economy.signup_bonus')) ?? 0;
    if (db && bonus > 0) await db.transaction(async (tx) => void (await applyLedgerEntry(tx, { userId, delta: bonus, reason: 'signup_bonus', refType: 'user', refId: userId, idempotencyKey: `signup_bonus:${userId}` })));
  };
  const auth = db && jwtSecret ? new AuthService(createDbUserRepository(db), createTokenSigner(jwtSecret), Math.random, grantSignupBonus) : undefined;
  const settings = db ? new SettingsService(createDbSettingsStore(db)) : undefined;
  const presence = new Presence();
  const notices = createLiveNotices();
  const baleToken = process.env.BALE_BOT_TOKEN;
  const baleUsername = process.env.BALE_BOT_USERNAME?.replace(/^@/, '') ?? null;
  const baleClient = baleToken ? createBaleClient(baleToken, { base: process.env.BALE_API_BASE }) : null;
  const baleStore: NotifyStore | undefined = db ? createDbNotifyStore(db) : undefined;
  const notify = baleStore ? new NotifyService(baleStore, baleClient) : undefined;
  // Browser push (Web Push, VAPID): iPhone home-screen apps through Apple's service, Chrome through Google's. Off without the three VAPID_* variables.
  const vapid = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY, subject: process.env.VAPID_SUBJECT ?? 'mailto:admin@dozari.ir' } : null;
  const webPush = db && vapid ? new WebPushService(createDbPushSubStore(db), createVapidSender(vapid), vapid.publicKey) : undefined;
  // Android app push (FCM HTTP v1, no SDK): `FCM_SERVICE_ACCOUNT_JSON` is the service-account key, as JSON text or a file path. Off without it.
  const fcmAccount = loadServiceAccount(process.env.FCM_SERVICE_ACCOUNT_JSON);
  const fcm = db && fcmAccount ? new FcmService(createDbFcmTokenStore(db), createFcmSender(fcmAccount)) : undefined;
  if (webPush || fcm) {
    notices.also = (id, n) => {
      void webPush?.notice(id, n).catch(() => undefined);
      void fcm?.notice(id, n).catch(() => undefined);
    };
  }
  // The SMS provider and message texts are edited in the admin panel (stored in app_settings); env vars are the fallback.
  const smsGateway = settings && db
    ? new SmsGateway(createDbSettingsStore(db), { irnotiKey: process.env.IRNOTI_API_KEY, irnotiMessage: process.env.IRNOTI_MESSAGE, irnotiLineId: process.env.IRNOTI_LINE_ID, irnotiPatternCode: process.env.IRNOTI_PATTERN_CODE, kavenegarKey: process.env.KAVENEGAR_API_KEY, kavenegarTemplate: process.env.KAVENEGAR_TEMPLATE })
    : undefined;
  await smsGateway?.refresh();
  const smsClient: SmsClient | null = smsGateway ? withSmsLogging(smsGateway) : null;
  const phone = db && settings ? new PhoneService(createDbPhoneStore(db), () => phoneRulesFromSettings(settings), smsClient, Date.now, undefined, async (id) => {
        const [row, lv] = await Promise.all([socialStore?.publicRow(id), player?.levelOf(id)]);
        return { nickname: row?.nickname ?? '', avatarKey: row?.avatarKey ?? 'avatar-01', level: lv?.level.level ?? 1, coins: row?.coins ?? 0 };
      }) : undefined;
  if (notify && phone) notify.phone = phone;
  if (notify && db) notify.signup = createBaleSignup(db, grantSignupBonus);
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
  const leaves = db && settings ? new LeaveService(createDbLeaveStore(db), () => leaveRulesFromSettings(settings)) : undefined;
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
        async (id) => (await leaves?.status(id))?.badgeUntil ?? null,
      )
    : undefined;
  const messages = db ? new MessageCenter(createDbMessageStore(db), notify ?? null, smsGateway ?? null) : undefined;
  if (messages) {
    // Online recipients get a nudge so the inbox badge moves without a reload; offline ones see it on the next load.
    messages.onDelivered = (ids) => {
      const online = new Set(presence.onlineIds());
      // Online players get the live nudge; the others a browser push (capped, so a broadcast to everybody does not become thousands of lookups).
      for (const id of ids) if (online.has(id)) notices.push(id, { kind: 'inbox' });
      for (const id of ids.filter((i) => !online.has(i)).slice(0, 500)) notices.also?.(id, { kind: 'inbox' });
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
  // A private message must be noticed wherever the friend is: a live notice if they are online, Bale (at most once per sender per 10 minutes) if not.
  if (chat) {
    const baleSeen = new Map<string, number>();
    chat.onDirect = (friendId, message) => {
      const nickname = message.nickname;
      if (presence.isOnline(friendId)) return void notices.push(friendId, { kind: 'dm', from: nickname });
      notices.also?.(friendId, { kind: 'dm', from: nickname });
      const key = `${message.userId}>${friendId}`;
      const last = baleSeen.get(key) ?? 0;
      if (Date.now() - last < 10 * 60_000) return;
      baleSeen.set(key, Date.now());
      void notify?.notify(friendId, 'chat_message', BALE_TEXT.chatMessage(nickname)).catch(() => undefined);
    };
  }
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
          topUp: botService ? async (missing) => void (await botService.generate({ count: missing, levelMin: 1, levelMax: 30, skillMin: 30, skillMax: 75, winPercentMin: 40, winPercentMax: 65, thinkMinMs: 4000, thinkMaxMs: 20_000, tauntPercent: 25, cityIds: playerStore ? (await playerStore.cities()).map((c) => c.id) : [] })) : undefined,
          taunts: chatStore ? async () => (await chatStore.taunts()).filter((c) => c.ageTrack === 'adult').map((c) => ({ nameFa: c.nameFa, ids: c.taunts.map((t) => t.id) })) : undefined,
          levelOf: player ? async (id) => (await player.levelOf(id)).level.level : undefined,
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
  const ads = db && settings ? new AdsService(createDbAdsStore(db), async () => (await settings.num('ads.enabled')) === 1) : undefined;
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
          tell: (ids, title, body, about) => messages?.tellUsers(ids, title, body, about ?? null) ?? Promise.resolve(),
          texts: { weekTitle: BIRTHDAY_TITLE.week, weekBody: BALE_TEXT.birthdayWeek, dayTitle: BIRTHDAY_TITLE.day, dayBody: BALE_TEXT.birthdayDay },
        })
      : undefined;
  const guardianStore = db ? createDbGuardianStore(db) : undefined;
  const guardianSettings = db ? new GuardianSettingsService(createDbGuardianSettingsStore(db)) : undefined;
  const playTime = db ? new PlayTimeService(createDbPlayTimeStore(db), dailyDateKey) : undefined;
  const blockStore = db ? createDbGuardianBlockStore(db) : undefined;
  const ageTracks = db && settings ? new AgeTrackService(createDbAgeTrackStore(db), async () => (await settings.num('feature.age_tracks')) === 1, () => new Date(), async (id) => (guardianStore ? (await guardianStore.guardianOf(id)) !== null : false), async (id) => (guardianStore && guardianSettings && (await guardianStore.guardianOf(id)) !== null ? { ...(await guardianSettings.limits(id)), playedToday: playTime ? await playTime.today(id) : 0 } : null)) : undefined;
  /** Same track and not blocked by a guardian (either direction): who a player may see, befriend, search and rank against. */
  const meetable = async (me: string, others: readonly string[]): Promise<Set<string>> => {
    const ok = ageTracks ? await ageTracks.meetable(me, others) : new Set(others);
    if (blockStore) for (const id of [...ok]) if (await blockStore.between(me, id)) ok.delete(id);
    return ok;
  };
  const guardian =
    db && auth && phoneLogin
      ? new GuardianService(createDbGuardianStore(db), createDbAgeTrackStore(db), phoneLogin, createDbPhoneStore(db), auth, () => `guardian:${randomUUID()}`)
      : undefined;
  const productAdmin = db ? createDbProductAdmin(db) : undefined;
  const feedback = db && settings && productAdmin ? buildFeedbackService({ db, settings, productAdmin, player, socialStore }) : undefined;
  const clientErrors = db ? createDbClientErrorStore(db) : undefined;
  const keepsakeStore = db ? createDbKeepsakeStore(db) : undefined;
  const keepsakes = keepsakeStore && settings ? new KeepsakeService(keepsakeStore, async () => (await settings.num('keepsake.drop_percent')) / 100, undefined, (id, ref, n) => wheel?.give(id, 'keepsake', ref, n) ?? Promise.resolve(0)) : undefined;
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
          tiers: async () =>
            duelTiers({
              bronzeFee: await settings.num('duel.entry_fee'),
              bronzeMinLevel: await settings.num('duel.min_level'),
              silverFee: await settings.num('duel.silver_fee'),
              silverMinLevel: await settings.num('duel.silver_min_level'),
              goldFee: await settings.num('duel.gold_fee'),
              goldMinLevel: await settings.num('duel.gold_min_level'),
            }),
          isBot: (id) => botDriver?.isBot(id) ?? false,
          priceWager: () => settings.num('duel.price_wager'),
          onWin: async (matchId, userId) => {
            await (wheel?.grantForWin(userId, matchId).catch((e) => console.error('[wheel] grant failed', matchId, e)) ?? Promise.resolve());
            await keepsakes?.dropForWin(userId, matchId);
          },
        })
      : undefined;
  /** Entry fees of private tables (the coin side of rounds + entry). */
  const tableStakes = db ? new TableStakes(createDbStakeStore(db), undefined, (id) => botDriver?.isBot(id) ?? false) : undefined;
  const tableService =
    settings && socialStore
      ? new TableService({
          profileOf: async (id) => socialStore.publicRow(id),
          startMatch: async (a, b, opts) => (live.matches ? live.matches.start(a, b, { friendly: true, boards: opts?.boards, fee: opts?.fee, priceRounds: opts?.priceRounds }) : false),
          startTeam: async (sides, opts) => (live.matches ? live.matches.startTeam(sides, opts) : false),
          coinsAllowed: ageTracks ? (id) => ageTracks.allows(id, 'coinWager') : undefined,
          balanceOf: tableStakes ? (id) => tableStakes.balance(id) : undefined,
          isBot: (id) => botDriver?.isBot(id) ?? false,
          scoresOf: (id) => live.matches?.scoresOf(id) ?? null,
          notify: (id, n) => notices.push(id, n),
          inMatch: (id) => live.matches?.inMatch(id) ?? false,
          trackOf: ageTracks ? (id) => ageTracks.effective(id) : undefined,
          socialBlocked: ageTracks ? (id) => ageTracks.socialBlocked(id) : undefined,
          duelsOff: ageTracks ? (id) => ageTracks.duelsOff(id) : undefined,
          banned: leaves ? (id) => leaves.isBanned(id) : undefined,
          minRounds: settings ? () => settings.num('table.min_rounds') : undefined,
          // A family is a guardian and their children (the guardian link is the whole proof; nobody else can open a family table).
          hasFamily: guardianStore ? async (id) => (await guardianStore.guardianOf(id)) !== null || (await guardianStore.childrenOf(id)).length > 0 : undefined,
          sameFamily: guardianStore
            ? async (a, b) => {
                const [ga, gb] = await Promise.all([guardianStore.guardianOf(a), guardianStore.guardianOf(b)]);
                return ga === b || gb === a || (ga !== null && ga === gb);
              }
            : undefined,
          idleMs: async () => (await settings.num('table.idle_minutes')) * 60_000,
        })
      : undefined;
  tableRef.svc = tableService;
  const ambientLobby =
    tableService && botDriver && settings
      ? new AmbientLobby({
          tables: tableService,
          roster: () => botDriver.rosterRows(),
          inMatch: (id) => live.matches?.inMatch(id) ?? false,
          settings: async () => ({ enabled: (await settings.num('bots.enabled')) === 1 && (await settings.num('feature.tables')) === 1, open: await settings.num('tables.ambient_open'), playing: await settings.num('tables.ambient_playing') }),
          rng: () => randomInt(0, 2 ** 30) / 2 ** 30,
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
          Date.now,
          ageTracks ? (me, others) => meetable(me, others) : undefined,
          ageTracks ? (id) => ageTracks.socialBlocked(id) : undefined,
          ageTracks ? (id) => ageTracks.friendsNeedApproval(id) : undefined,
        )
      : undefined;
  if (chat && ageTracks) chat.managed = { trackOf: (id) => ageTracks.effective(id), hasGuardian: async (id) => (guardianStore ? (await guardianStore.guardianOf(id)) !== null : false), chatMode: async (id) => ((await ageTracks.featureOff(id, 'chat')) ? 'off' : guardianSettings ? (await guardianSettings.get(id)).chatMode : 'friends_text') };
  if (social && find) social.contactNotes = (me, ids) => find.contactNotes(me, ids);
  if (social && ageTracks) {
    social.sameTrack = meetable;
    social.blocked = (id) => ageTracks.socialBlocked(id);
    social.asksGuardian = (id) => ageTracks.friendsNeedApproval(id);
    social.cityVisible = (id) => ageTracks.allows(id, 'publicCity');
    social.profileDepth = (id) => ageTracks.profileDepth(id);
  }
  const lessonSeen = db ? createDbLessonSeenStore(db) : undefined;
  if (ageTracks && settings) ageTracks.featureSwitch = async (key) => (await settings.num(key)) !== 0;
  const playerAudit = db ? createDbAuditLog(db) : undefined;
  if (ageTracks && playerAudit) ageTracks.audit = (a, t, d) => void playerAudit.record(a, t, d);
  // A child with games played or friends has a record: removing them needs a code.
  if (guardian && player && socialStore) guardian.history = async (id) => (await player.levelOf(id)).stats.games > 0 || (await socialStore.friends(id)).length > 0;
  if (guardian && playerAudit) guardian.audit = (a, t, d) => void playerAudit.record(a, t, d);
  if (invite && ageTracks) invite.canShare = (id) => ageTracks.allows(id, 'inviteShare');
  if (guardian && guardianSettings) guardian.settings = guardianSettings;
  if (guardian && blockStore) guardian.blocks = blockStore;
  if (guardian && lessonSeen && player && socialStore) {
    guardian.digest = createDigestBuilder({ seen: lessonSeen, recentGames: (id, n) => player.recentGames(id, n), level: async (id) => (await player.levelOf(id)).level.level, friendCount: async (id) => (await socialStore.friends(id)).length, minutesWeek: playTime ? (id) => playTime.week(id) : undefined });
  }
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
  const avatarStore: AvatarStore | undefined = db ? createDbAvatarStore(db) : undefined;
  const avatars = avatarStore && settings
    ? new AvatarService(avatarStore, levelOf, async () => ({ unlockGames: (await settings.num('profile.avatar_unlock_games')) ?? AVATAR_UNLOCK_GAMES, minLevel: (await settings.num('profile.avatar_change_min_level')) ?? AVATAR_CHANGE_MIN_LEVEL }))
    : undefined;
  const landingService = db ? new LandingService(createDbLandingStore(db), Date.now, words ? async (t) => { const r = await words.check(t); return r.ok ? { ok: true, text: r.text } : { ok: false }; } : undefined) : undefined;
  const shortLinkService = db && settings ? new ShortLinkService(createDbShortLinkStore(db), () => settings.text('domain.short')) : undefined;
  if (social && shopStore) {
    const wardrobe = new ShopService(shopStore, levelOf);
    social.wornOf = (id) => wardrobe.worn(id);
  }
  if (player && avatars) player.canWearAvatar = (id, key) => avatars.canWear(id, key);
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
    // Mini-app players pay without linking the bot: the paying Bale user maps to their mini-app account (same device id as the login).
    if (baleToken) notify.miniAppUserOf = async (baleUserId) => (await auth?.userByDevice(miniAppDeviceId(baleToken, baleUserId)))?.id ?? null;
  }
  const gemPayer = db ? createGemCardPayer(db, (msg, err) => console.error(msg, err)) : () => undefined;
  let dailyRef: DailyService | undefined;
  /** Puzzles each player has had in duels, tables and 2v2: nobody gets the same one again while others remain (solo keeps its own recent list). */
  const puzzleHistory = new PuzzleHistory();
  const solo =
    db && settings
      ? new SoloService(createDbPuzzleSource(db), {
          rules: () => soloRules(settings),
          gemCard: () => gemCardRules(settings),
          onGem: gemPayer,
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
  const triviaStore = db ? createDbTriviaStore(db) : undefined;
  const trivia = triviaStore ? new TriviaService(triviaStore, { perGame: settings ? () => settings.num('trivia.questions') : undefined }) : undefined;
  const dailyStore = db ? createDbDailyStore(db) : undefined;
  const daily = dailyStore && solo && settings ? new DailyService(dailyStore, solo, { num: (k) => settings.num(k) }) : undefined;
  dailyRef = daily;
  const botRepo = db ? createDbBotRepository(db) : undefined;
  const bot = botRepo ? new BotService(botRepo) : undefined;
  // Database backups to S3 targets: needs a database and a sealing key for the stored secrets (BACKUP_SECRET_KEY, else ADMIN_TOKEN).
  const backupSealKey = process.env.BACKUP_SECRET_KEY || adminToken;
  const backupService =
    db && backupSealKey && process.env.DATABASE_URL
      ? new BackupService({
          store: createDbBackupStore(db),
          box: createSecretBox(backupSealKey),
          storage: createS3Storage,
          dumper: createMysqldumpDumper(parseDatabaseUrl(process.env.DATABASE_URL), { bin: process.env.MYSQLDUMP_BIN, extraArgs: process.env.BACKUP_DUMP_ARGS?.split(/\s+/).filter(Boolean) }),
          log: (msg, err) => console[err ? 'error' : 'log'](msg, err ?? ''),
          protectLast: process.env.BACKUP_PROTECT_LAST ? Number(process.env.BACKUP_PROTECT_LAST) || undefined : undefined,
        })
      : undefined;
  const aiStudio = db ? new AiStudio({ env: process.env, lessons: createDbLessonStore(db), puzzles: createDbPuzzleAdmin(db), categories: createDbCategoryAdmin(db), trivia: triviaStore, products: productAdmin, landing: landingService, catalog: async () => (await createDbAdminRepository(db).listCatalog()).map((p) => ({ id: p.id, slug: p.slug, nameFa: p.nameFa })) }) : undefined;
  const aiScheduler = db && aiStudio ? new AiScheduler(createDbAiScheduleStore(db), aiStudio, { audit: (action, target, detail) => void playerAudit?.record(action, target, detail), log: (msg, err) => app.log.error({ err }, msg) }) : undefined;
  const reportError = createErrorReporter({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV, release: process.env.APP_RELEASE });
  const profileTaskService = db && settings ? new ProfileTaskService({
      ...createDbProfileTaskStore(db),
      coins: async () => {
        const entries = await Promise.all(MISSION_KEYS.map(async (k) => [k, (await settings.num(`profiletask.coins_${k}`)) ?? 0] as const));
        return Object.fromEntries(entries) as Record<MissionKey, number>;
      },
    }) : undefined;
  // Proving a number by login is the «phone» mission: pay it now (idempotent; a second login or an unpaid mission is simply skipped).
  if (phoneLogin && profileTaskService) phoneLogin.afterVerify = async (userId) => void (await profileTaskService.claim(userId, 'phone'));
  const matchPuzzleSource = db ? createDbPuzzleSource(db) : undefined;
  const app = buildServer({
    reportError,
    auth,
    settings,
    adminModules: db
      ? { backups: backupService, images: adminImageStore(), products: productAdmin!, feedback, clientErrors, stats: createDbStatsAdmin(db), users: createDbUsersAdmin(db), audit: createDbAuditLog(db), words, cities: playerStore, shop: shopStore, avatars: avatarStore, keepsakes: keepsakeStore, wheel, ads, landing: landingService, shortLinks: shortLinkService && settings ? { service: shortLinkService, base: async () => { const h = (await settings.text('domain.short')).trim(); return h ? `https://${h}` : ''; } } : undefined, coinPackages: coinPackageService, invites: inviteStore, badges: badgeStore && badges ? { store: badgeStore, service: badges } : undefined, chat: chatStore, tournaments: tournamentService, sponsors: sponsorStore, lessons: db ? createDbLessonStore(db) : undefined, ageTracks: db ? createDbAgeTrackAdmin(db) : undefined, economy: db ? createDbEconomyAdmin(db) : undefined, daily, ai: aiStudio, aiSchedules: aiScheduler, puzzles: createDbPuzzleAdmin(db), categories: createDbCategoryAdmin(db), trivia: triviaStore, leaves, levelRoad: levelTable && settings ? { table: levelTable, defaults: async () => { const [curveBase, levelMax, every, base] = await Promise.all(['xp.curve_base', 'xp.level_max', 'levelreward.every', 'levelreward.base_coins'].map((k) => settings.num(k))); return defaultLevelTable({ curveBase: curveBase!, levelMax: levelMax! }, { every: every!, base: base! }); } } : undefined, botPlayers: botStore && player && settings && botService ? { service: botService, cities: async () => (playerStore ? (await playerStore.cities()).map((c) => c.id) : []) } : undefined, messages, sms: smsGateway, bale: notify && baleStore ? { service: notify, store: baleStore, botUsername: baleUsername } : undefined, bot: botRepo && bot ? { repo: botRepo, service: bot } : undefined }
      : undefined,
    realtime: Boolean(auth),
    match: db
      ? {
          puzzles: matchPuzzleSource!,
          history: puzzleHistory,
          trackOf: ageTracks ? (id) => ageTracks.effective(id) : undefined,
          wagerAllowed: ageTracks ? (id) => ageTracks.allows(id, 'coinWager') : undefined,
          teamBoards: settings ? () => settings.num('match.team_boards') : undefined,
          duelRounds: settings ? () => settings.num('match.duel_rounds') : undefined,
          topicDraft: settings ? async () => (await settings.num('match.topic_draft')) === 1 : undefined,
          topics: async (tracks) => (await matchPuzzleSource?.topics?.(tracks)) ?? [],
          isBot: (id) => botDriver?.isBot(id) ?? false,
          itemsOf: shopStore ? async (ids) => Object.fromEntries(await Promise.all(ids.map(async (id) => [id, botDriver?.isBot(id) ? { shuffle: 0, reveal: 0 } : await shopStore.matchItems(id)] as const))) : undefined,
          consumeItem: shopStore ? (id, effect) => shopStore.consumeMatchItem(id, effect) : undefined,
          refundItem: shopStore ? (id, effect) => shopStore.refundMatchItem(id, effect) : undefined,
          onLeave: leaves ? (i) => { if (!botDriver?.isBot(i.userId)) void leaves.record(i.userId, i.matchId, i.kind).catch(() => undefined); } : undefined,
          gemCard: settings ? () => gemCardRules(settings) : undefined,
          onGem: (id, amount, key) => {
            if (!botDriver?.isBot(id)) gemPayer(id, amount, key);
          },
          priceRound: settings ? async () => (await settings.num('match.price_round')) === 1 : undefined,
          triviaRounds: settings ? () => settings.num('match.trivia_rounds') : undefined,
          triviaQuestions: triviaStore
            ? async ({ topicIds, tracks, count, rng }) => {
                // The match's own topics first, then the whole bank, so a thin topic never leaves the round short.
                const own = topicIds?.length ? (await Promise.all([...new Set(topicIds)].map((topicId) => triviaStore.approved({ topicId, tracks, limit: 60 })))).flat() : [];
                const picked = pickTriviaQuestions(own, count, rng);
                if (picked.length < count) picked.push(...pickTriviaQuestions(await triviaStore.approved({ tracks, limit: Math.max(60, count * 6) }), count - picked.length, rng, new Set(picked.map((q) => q.id))));
                return picked.map((q) => ({ id: q.id, textFa: q.textFa, explanationFa: q.explanationFa, ...shuffleTrivia(q, rng) }));
              }
            : undefined,
          rules: settings
            ? async () => {
                const [turnSeconds, maxMistakes, maxTimeouts, groupPoints, firstBloodBonus, separate] = await Promise.all([settings.num('game.turn_seconds'), settings.num('game.match_max_mistakes'), settings.num('game.max_consecutive_timeouts'), settings.list('score.group_points'), settings.num('score.first_blood_bonus'), settings.num('match.separate_boards')]);
                return { turnSeconds, maxMistakes, maxTimeouts, groupPoints, firstBloodBonus, separateBoards: separate === 1 };
              }
            : undefined,
          stakes: duelStakes,
          tableStakes,
          profile: (() => {
            const base = createDbProfileLookup(db, player ? async (id) => (await player.levelOf(id)).level.level : undefined);
            return async (id: string) => {
              const p = await base(id);
              if (!p) return p;
              const party = await birthday?.info([id]);
              return party?.get(id)?.badge ? { ...p, birthday: true } : p;
            };
          })(),
          // A 2v2 earns the duel XP too (progression.md: team reuses the duel base) — people and bots alike.
          onTeamEnded: ({ players, result }) => {
            if (result.reason === 'abandon') return;
            for (const p of players) void player?.recordGame(p.userId, { mode: 'duel', outcome: result.winner === null ? 'draw' : result.winner === p.side ? 'win' : 'loss' });
          },
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
    ambientLobby,
    presence,
    notices,
    webPush,
    fcm,
    notify,
    messages,
    social,
    invite,
    transfers,
    keepsakes,
    wheel,
    ads,
    dailyReward: db && settings ? new DailyRewardService(createDbDailyRewardStore(db), Date.now, () => dailyRules(settings)) : undefined,
    catalog: db ? createDbCatalogRepository(db) : undefined,
    categories: db ? async () => (await createDbCategoryAdmin(db).list()).filter((c) => c.isActive).map((c) => ({ slug: c.slug, nameFa: c.nameFa })) : undefined,
    solo,
    priceOnly,
    trivia: trivia ? { service: trivia, tracksOf: ageTracks ? async (id) => (id ? trackRules(await ageTracks.effective(id)).puzzleTracks : ['adult']) : undefined } : undefined,
    levelOf,
    duelLevelGate: settings && player ? async (id) => (await player.levelOf(id)).level.level >= (await settings.num('duel.min_level')) : undefined,
    tables: tableService,
    duelStakes,
    leaves,
    limiter: db && settings ? new PlayLimiter(createDbPlayCountStore(db), async (mode) => settings.num(mode === 'solo' ? 'limit.solo_per_day' : 'limit.duel_per_day')) : undefined,
    hints: solo && shopStore && settings ? new HintService(solo, shopStore, () => hintRules(settings), levelOf) : undefined,
    shop: shopStore
      ? new ShopService(
          shopStore,
          levelOf,
          Date.now,
          settings ? () => settings.num('shop.daily_slots') : undefined,
          // A gift goes to a friend in their birthday week, once per friend per birthday year.
          socialStore && birthday
            ? async (giver, to) => {
                if (!(await socialStore.friends(giver)).some((f) => f.id === to)) return { ok: false, error: 'not_friends' } as const;
                if (!(await birthday.info([to])).get(to)?.badge) return { ok: false, error: 'not_birthday' } as const;
                return { ok: true, key: `${giver}:${to}:${todayInTehran(Date.now()).year}` } as const;
              }
            : undefined,
          // The friend finds it in their inbox; tapping it opens the giver's profile.
          (giver, to, item) => {
            void (async () => {
              const from = (await socialStore?.publicRow(giver))?.nickname ?? '';
              await messages?.tellUsers([to], BIRTHDAY_TITLE.gift, BALE_TEXT.birthdayGift(from, item.titleFa), giver);
            })().catch(() => undefined);
          },
        )
      : undefined,
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
    playTime,
    canPreview: guardianStore ? async (id) => (await guardianStore.childrenOf(id)).length > 0 : undefined,
    lessons: db ? createDbLessonStore(db) : undefined,
    lessonSeen,
    guardian,
    feedback,
    clientErrors,
    avatars,
    profileTasks: profileTaskService,
    coinPackages: coinPackageService,
    shopReal,
    shortLinks: shortLinkService,
    landing: landingService,
    clientInfo: db ? createDbClientInfoStore(db) : undefined,
    admin: db && jwtSecret ? { repo: createDbAdminRepository(db), token: adminToken, accounts: new AdminAccounts(createDbAdminStore(db), jwtSecret, adminToken) } : undefined,
    corsOrigin: process.env.CORS_ORIGIN,
    miniApp: { bale: baleToken, telegram: process.env.TELEGRAM_BOT_TOKEN },
    trustProxy: process.env.TRUST_PROXY === '1',
    localImagesDir: process.env.LOCAL_IMAGES_DIR,
  });
  if (botDriver) {
    void botDriver.refresh().catch(() => undefined);
    const botTimer = setInterval(() => void botDriver.tick().catch((err) => app.log.error({ err }, 'bot tick failed')), 5000);
    botTimer.unref();
    app.addHook('onClose', async () => clearInterval(botTimer));
  }
  if (ambientLobby) {
    const lobbyTimer = setInterval(() => void ambientLobby.tick().catch((err) => app.log.error({ err }, 'lobby tick failed')), 5000);
    lobbyTimer.unref();
    app.addHook('onClose', async () => clearInterval(lobbyTimer));
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
  if (backupService && process.env.BACKUP_SCHEDULER !== 'off') {
    const backups = startBackupScheduler({ service: backupService, log: (msg, err) => (err ? app.log.error({ err }, msg) : app.log.info(msg)) });
    app.addHook('onClose', async () => {
      backups.stop();
      await backupService.idle();
    });
  }
  if (aiScheduler && process.env.AI_SCHEDULER !== 'off') {
    const aiRuns = startAiScheduler({ scheduler: aiScheduler, log: (msg, err) => (err ? app.log.error({ err }, msg) : app.log.info(msg)) });
    app.addHook('onClose', async () => aiRuns.stop());
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
  // Deploys send SIGTERM: stop accepting work and run every onClose hook (timers, sockets) instead of dying mid-request.
  let closing = false;
  const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    app.log.info(`${signal} received, shutting down`);
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    app.close().then(() => process.exit(0), (err) => (app.log.error({ err }, 'shutdown failed'), process.exit(1)));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  app.listen({ port, host: '0.0.0.0' }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
