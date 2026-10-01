import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { resolve } from 'node:path';
import { rialsToTomanString } from '@dozari/shared';
import { createDb } from '@dozari/db';
import { createDbCatalogRepository } from './catalog/db-repository.js';
import { DailyRewardService } from './economy/daily-reward.js';
import { createDbDailyRewardStore } from './economy/daily-reward-db.js';
import { registerDailyRewardRoutes } from './economy/routes.js';
import { AuthService } from './auth/service.js';
import { createDbUserRepository } from './auth/db-repository.js';
import { attachGateway } from './realtime/gateway.js';
import type { Gateway } from './realtime/gateway.js';
import { registerAuthRoutes } from './auth/routes.js';
import { createTokenSigner } from './auth/tokens.js';
import { createDbAdminRepository } from './admin/db-repository.js';
import { registerAdminRoutes } from './admin/routes.js';
import type { AdminModules } from './admin/module-routes.js';
import { createDbAuditLog } from './admin/audit.js';
import { createDbProductAdmin } from './admin/products.js';
import { createDbStatsAdmin } from './admin/stats.js';
import { createDbUsersAdmin } from './admin/users.js';
import { createDbBotRepository } from './bot/repository.js';
import { BotService } from './bot/service.js';
import { startBotScheduler } from './bot/scheduler.js';
import { TextFilterService, createDbWordStore } from './textfilter/service.js';
import { createDbSettingsStore } from './settings/db-store.js';
import { SettingsService } from './settings/service.js';
import type { AdminRepository } from './admin/routes.js';
import { registerCatalogRoutes, registerLookupRoutes } from './catalog/routes.js';
import { isMainModule } from './is-main.js';
import { createDbPuzzleSource } from './solo/db-source.js';
import { registerSoloRoutes } from './solo/routes.js';
import { SoloService } from './solo/service.js';
import type { CatalogRepository } from './catalog/routes.js';

export interface ServerDeps {
  catalog?: CatalogRepository;
  /** Interim catalog review page + API at `/admin`; registered only when a token is provided. */
  admin?: { repo: AdminRepository; token: string };
  /** Guest accounts and sessions (`/auth/guest`, `/me`). */
  auth?: AuthService;
  /** Daily reward (`/daily-reward`, and the admin editor); needs `auth` for the player routes. */
  dailyReward?: DailyRewardService;
  /** Socket.io service (queue, matches); needs `auth`. Its live stats feed the admin panel. */
  realtime?: boolean;
  /** Admin-editable tunables; also served to clients at `GET /config`. */
  settings?: SettingsService;
  /** Extra admin panel modules (products editor, users, stats, bot, audit). */
  adminModules?: Omit<AdminModules, 'settings'>;
  /** Solo practice sessions (`/solo/*`). */
  solo?: SoloService;
  /** Allowed browser origins (e.g. Expo web dev). `*` allows any. Off when unset: native apps don't need CORS. */
  corsOrigin?: string;
  /** Docker-free dev: directory of uploaded product images, served at `/images/*`. */
  localImagesDir?: string;
}

export function buildServer(deps: ServerDeps = {}) {
  const app = Fastify({ logger: true });

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
  if (deps.settings) {
    const settings = deps.settings;
    app.get('/config', async () => ({ settings: await settings.publicValues() }));
  }
  if (deps.catalog) {
    registerCatalogRoutes(app, deps.catalog);
    registerLookupRoutes(app, deps.catalog);
  }
  if (deps.solo) registerSoloRoutes(app, deps.solo);
  let gateway: Gateway | undefined;
  if (deps.auth && deps.realtime) {
    const auth = deps.auth;
    gateway = attachGateway(app.server, { authenticate: (t) => auth.authenticate(t), corsOrigin: deps.corsOrigin });
    app.addHook('onClose', async () => {
      await gateway?.close();
    });
  }
  if (deps.admin) registerAdminRoutes(app, deps.admin.repo, deps.admin.token, { dailyReward: deps.dailyReward, socketStats: gateway?.stats, settings: deps.settings, ...deps.adminModules });
  if (deps.localImagesDir) {
    void app.register(fastifyStatic, { root: resolve(deps.localImagesDir), prefix: '/images/' });
  }

  return app;
}

/** Live tunables for the daily reward (admin settings). */
async function dailyRules(settings: SettingsService) {
  return { cooldownHours: await settings.num('economy.daily_cooldown_hours'), windowHours: await settings.num('economy.daily_streak_window_hours') };
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
  const db = process.env.DATABASE_URL ? createDb() : undefined;
  const adminToken = process.env.ADMIN_TOKEN;
  const jwtSecret = process.env.JWT_SECRET ?? (process.env.NODE_ENV === 'production' ? undefined : 'dev-only-secret-change-me');
  if (db && !jwtSecret) throw new Error('JWT_SECRET is required in production');
  const auth = db && jwtSecret ? new AuthService(createDbUserRepository(db), createTokenSigner(jwtSecret)) : undefined;
  const settings = db ? new SettingsService(createDbSettingsStore(db)) : undefined;
  const botRepo = db ? createDbBotRepository(db) : undefined;
  const bot = botRepo ? new BotService(botRepo) : undefined;
  const app = buildServer({
    auth,
    settings,
    adminModules: db
      ? { products: createDbProductAdmin(db), stats: createDbStatsAdmin(db), users: createDbUsersAdmin(db), audit: createDbAuditLog(db), words: new TextFilterService(createDbWordStore(db)), bot: botRepo && bot ? { repo: botRepo, service: bot } : undefined }
      : undefined,
    realtime: Boolean(auth),
    dailyReward: db && settings ? new DailyRewardService(createDbDailyRewardStore(db), Date.now, () => dailyRules(settings)) : undefined,
    catalog: db ? createDbCatalogRepository(db) : undefined,
    solo: db && settings ? new SoloService(createDbPuzzleSource(db), { rules: () => soloRules(settings) }) : undefined,
    admin: db && adminToken ? { repo: createDbAdminRepository(db), token: adminToken } : undefined,
    corsOrigin: process.env.CORS_ORIGIN,
    localImagesDir: process.env.LOCAL_IMAGES_DIR,
  });
  if (bot && settings && process.env.BOT_SCHEDULER !== 'off') {
    const scheduler = startBotScheduler({ bot, settings, log: (msg, err) => (err ? app.log.error({ err }, msg) : app.log.info(msg)) });
    app.addHook('onClose', async () => scheduler.stop());
  }
  const port = Number(process.env.PORT ?? 3000);
  app.listen({ port, host: '0.0.0.0' }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
