import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MIN_PRICE_POINTS_PER_PRODUCT, PRICE_STATUSES, priceRange } from '@dozari/shared';
import type { PriceMark } from '@dozari/shared';
import type { DailyRewardService } from '../economy/daily-reward.js';
import { registerDailyRewardAdminRoutes } from '../economy/routes.js';
import type { SocketStats } from '../realtime/stats.js';
import { randomBytes } from 'node:crypto';
import { AdminAccounts } from './accounts/service.js';
import { createMemoryAdminStore } from './accounts/store.js';
import { can, permissionFor } from './accounts/permissions.js';
import { registerAdminAccountRoutes, registerAdminLogin } from './accounts/routes.js';
import { auditActor } from './audit.js';
import { RateLimiter } from '../security/rate-limit.js';
import { registerAdminModules } from './module-routes.js';
import type { AdminModules } from './module-routes.js';
import { ADMIN_PAGE_HTML } from './page.js';

export type PriceStatus = (typeof PRICE_STATUSES)[number];

export interface AdminPriceDto {
  id: string;
  year: number;
  month: number | null;
  /** Integer rials as a decimal string (BIGINT is not JSON-safe). */
  priceRials: string;
  sourceType: string;
  sourceUrl: string | null;
  sourceNote: string | null;
  confidence: number;
  status: PriceStatus;
}

export interface AdminProductDto {
  id: string;
  slug: string;
  nameFa: string;
  unitFa: string | null;
  prices: AdminPriceDto[];
}

export type SetStatusResult = 'ok' | 'not_found' | 'conflict';

/** I/O boundary for the catalog review tool. */
export interface AdminRepository {
  /** Every product with all of its price points (any status), prices ordered by year, month. */
  listCatalog(): Promise<AdminProductDto[]>;
  /** `conflict` = another approved point already exists for the same (product, year, month). */
  setPriceStatus(priceId: string, status: PriceStatus): Promise<SetStatusResult>;
}

const markDto = (m: PriceMark) => ({ year: m.year, month: m.month, priceRials: m.priceRials.toString() });

/** Range of the approved prices (what players see), plus whether the product is below the minimum number of points. */
function rangeSummary(prices: readonly AdminPriceDto[]) {
  const approved = prices.filter((x) => x.status === 'approved').map((x) => ({ year: x.year, month: x.month, priceRials: BigInt(x.priceRials) }));
  const r = priceRange(approved);
  return {
    range: r ? { count: r.count, first: markDto(r.first), last: markDto(r.last), min: markDto(r.min), max: markDto(r.max) } : null,
    needsMorePrices: approved.length < MIN_PRICE_POINTS_PER_PRODUCT,
  };
}

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({ status: z.enum(PRICE_STATUSES) });

/**
 * Interim catalog review tool (Phase 1): approve / reject / re-queue price points.
 * Only registered when an ADMIN_TOKEN is configured. The real admin panel is Phase 7
 * (docs/logic/app-screens.md §Admin panel) and will replace this.
 */
export interface AdminExtras extends AdminModules {
  /** Daily reward amounts editor. */
  dailyReward?: DailyRewardService;
  /** Live numbers of the socket service. */
  socketStats?: SocketStats;
  /** Admin accounts with roles; without it only the static token (owner) works. */
  accounts?: AdminAccounts;
}

export function registerAdminRoutes(app: FastifyInstance, repo: AdminRepository, token: string | undefined, extras: AdminExtras = {}) {
  const accounts = extras.accounts ?? new AdminAccounts(createMemoryAdminStore(), randomBytes(32).toString('hex'), token);
  registerAdminLogin(app, accounts);
  // The page itself carries no data; every data call below needs the token.
  app.get('/admin', async (_req, reply) => reply.type('text/html; charset=utf-8').send(ADMIN_PAGE_HTML));

  app.register(async (guarded) => {
    // Guessing the token: 10 wrong tries per 15 minutes per IP, then locked out for the rest of the window.
    const failures = new RateLimiter(10, 15 * 60_000);
    guarded.addHook('onRequest', async (req, reply) => {
      if (failures.blocked(req.ip)) return reply.header('retry-after', String(failures.retryAfterSec(req.ip))).code(429).send({ error: 'rate_limited' });
      const given = req.headers['x-admin-token'];
      const actor = typeof given === 'string' && given.length > 0 ? await accounts.authenticate(given) : null;
      if (!actor) {
        failures.take(req.ip);
        return reply.code(401).send({ error: 'unauthorized' });
      }
      const needs = permissionFor(req.method, req.url.split('?')[0] ?? '');
      if (!can(actor.role, needs)) return reply.code(403).send({ error: 'forbidden', needs });
      req.adminActor = actor;
    });
    // Everything the handler (and its audit calls) does runs "as" this admin.
    guarded.addHook('preHandler', (req, _reply, done) => auditActor.run(req.adminActor?.name ?? 'unknown', done));
    registerAdminAccountRoutes(guarded, accounts, (action, target, detail) => void extras.audit?.record(action, target, detail));

    if (extras.dailyReward) registerDailyRewardAdminRoutes(guarded, extras.dailyReward);
    registerAdminModules(guarded, extras);

    if (extras.socketStats) {
      const stats = extras.socketStats;
      guarded.get('/admin/socket', async () => stats.snapshot());
    }

    guarded.get('/admin/catalog', async () => {
      const list = await repo.listCatalog();
      const details = extras.products ? await extras.products.details() : {};
      return { products: list.map((p) => ({ ...p, ...(details[p.id] ?? {}), ...rangeSummary(p.prices) })) };
    });

    guarded.patch('/admin/prices/:id', async (req, reply) => {
      const params = paramsSchema.safeParse(req.params);
      const body = bodySchema.safeParse(req.body);
      if (!params.success || !body.success) return reply.code(400).send({ error: 'invalid_request' });
      const result = await repo.setPriceStatus(params.data.id, body.data.status);
      if (result === 'not_found') return reply.code(404).send({ error: 'price_not_found' });
      if (result === 'conflict') return reply.code(409).send({ error: 'approved_price_exists' });
      return { id: params.data.id, status: body.data.status };
    });
  });
}
