import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PRICE_STATUSES } from '@dozari/shared';
import type { DailyRewardService } from '../economy/daily-reward.js';
import { registerDailyRewardAdminRoutes } from '../economy/routes.js';
import type { SocketStats } from '../realtime/stats.js';
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

const digest = (s: string) => createHash('sha256').update(s).digest();

function tokenMatches(req: FastifyRequest, token: string): boolean {
  const given = req.headers['x-admin-token'];
  if (typeof given !== 'string') return false;
  return timingSafeEqual(digest(given), digest(token));
}

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({ status: z.enum(PRICE_STATUSES) });

/**
 * Interim catalog review tool (Phase 1): approve / reject / re-queue price points.
 * Only registered when an ADMIN_TOKEN is configured. The real admin panel is Phase 7
 * (docs/logic/app-screens.md §Admin panel) and will replace this.
 */
export interface AdminExtras {
  /** Daily reward amounts editor. */
  dailyReward?: DailyRewardService;
  /** Live numbers of the socket service. */
  socketStats?: SocketStats;
}

export function registerAdminRoutes(app: FastifyInstance, repo: AdminRepository, token: string, extras: AdminExtras = {}) {
  // The page itself carries no data; every data call below needs the token.
  app.get('/admin', async (_req, reply) => reply.type('text/html; charset=utf-8').send(ADMIN_PAGE_HTML));

  app.register(async (guarded) => {
    guarded.addHook('onRequest', async (req, reply) => {
      if (!tokenMatches(req, token)) return reply.code(401).send({ error: 'unauthorized' });
    });

    if (extras.dailyReward) registerDailyRewardAdminRoutes(guarded, extras.dailyReward);

    if (extras.socketStats) {
      const stats = extras.socketStats;
      guarded.get('/admin/socket', async () => stats.snapshot());
    }

    guarded.get('/admin/catalog', async () => ({ products: await repo.listCatalog() }));

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
