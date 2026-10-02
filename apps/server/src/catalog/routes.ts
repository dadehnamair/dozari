import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { normalizeForFilter, PRODUCT_CATEGORIES, priceOnDate, priceRange } from '@dozari/shared';
import type { LookupDetail, LookupHit, LookupRange } from '@dozari/shared';

export interface ProductDto {
  id: string;
  slug: string;
  nameFa: string;
  brand: string | null;
  category: string;
  unitFa: string | null;
  audience: string[];
  eraTags: string[];
  storyFa: string | null;
  status: string;
  iconKey: string | null;
}

export interface PricePointDto {
  year: number;
  month: number | null;
  /** Integer rials as a decimal string (BIGINT is not JSON-safe). Nominal, never adjusted. */
  priceRials: string;
  sourceType: string;
  confidence: number;
}

/** I/O boundary so routes are testable without a database. */
export interface CatalogRepository {
  /** Active products, ordered by slug. */
  listProducts(): Promise<ProductDto[]>;
  getProduct(id: string): Promise<ProductDto | null>;
  /** Approved points only, ordered by year then month. */
  listApprovedPrices(productId: string): Promise<PricePointDto[]>;
}

const paramsSchema = z.object({ id: z.string().uuid() });

export function registerCatalogRoutes(app: FastifyInstance, repo: CatalogRepository) {
  app.get('/products', async () => ({ products: await repo.listProducts() }));

  app.get('/products/:id', async (req, reply) => {
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_id' });
    const product = await repo.getProduct(params.data.id);
    if (!product) return reply.code(404).send({ error: 'product_not_found' });
    return product;
  });

  app.get('/products/:id/prices', async (req, reply) => {
    const params = paramsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_id' });
    if (!(await repo.getProduct(params.data.id))) {
      return reply.code(404).send({ error: 'product_not_found' });
    }
    return { productId: params.data.id, prices: await repo.listApprovedPrices(params.data.id) };
  });
}

const mark = (m: { year: number; month: number | null; priceRials: bigint }) => ({ year: m.year, month: m.month, priceRials: m.priceRials.toString() });

async function hitOf(repo: CatalogRepository, p: ProductDto, prices?: PricePointDto[]): Promise<LookupHit> {
  const pts = prices ?? (await repo.listApprovedPrices(p.id));
  const r = priceRange(pts.map((x) => ({ year: x.year, month: x.month, priceRials: BigInt(x.priceRials) })));
  const range: LookupRange | null = r ? { count: r.count, first: mark(r.first), last: mark(r.last), min: mark(r.min), max: mark(r.max) } : null;
  return { id: p.id, nameFa: p.nameFa, unitFa: p.unitFa, iconKey: p.iconKey, category: p.category, range };
}

const searchQuery = z
  .object({ q: z.string().trim().max(60).optional(), category: z.enum(PRODUCT_CATEGORIES).optional() })
  .refine((v) => Boolean(v.q) || Boolean(v.category));
const detailQuery = z.object({ year: z.coerce.number().int().min(1300).max(1450).optional(), month: z.coerce.number().int().min(1).max(12).optional() });

/** Price lookup «استعلام قیمت» (D70): answers only from approved price points; no estimates. */
export function registerLookupRoutes(app: FastifyInstance, repo: CatalogRepository) {
  app.get('/lookup/search', async (req, reply) => {
    const q = searchQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'invalid_request' });
    // Every typed word must start some word of the name or brand («نان» must not match «جوانان»).
    const words = (text: string) => normalizeForFilter(text).split(/\s+/).filter(Boolean);
    const typed = words(q.data.q ?? '');
    const matches = (await repo.listProducts())
      .filter((p) => {
        if (q.data.category && p.category !== q.data.category) return false;
        const have = words(`${p.nameFa} ${p.brand ?? ''}`);
        return typed.every((t) => have.some((w) => w.startsWith(t)));
      })
      .slice(0, q.data.category && typed.length === 0 ? 40 : 20);
    return { results: await Promise.all(matches.map((p) => hitOf(repo, p))) };
  });

  app.get('/lookup/:id', async (req, reply) => {
    const params = paramsSchema.safeParse(req.params);
    const query = detailQuery.safeParse(req.query);
    if (!params.success || !query.success) return reply.code(400).send({ error: 'invalid_request' });
    const product = await repo.getProduct(params.data.id);
    if (!product) return reply.code(404).send({ error: 'product_not_found' });
    const prices = await repo.listApprovedPrices(product.id);
    const at = query.data.year
      ? priceOnDate(prices.map((x) => ({ year: x.year, month: x.month, priceRials: BigInt(x.priceRials) })), query.data.year, query.data.month ?? null)
      : null;
    const body: LookupDetail = {
      product: await hitOf(repo, product, prices),
      points: prices.map((x) => ({ year: x.year, month: x.month, priceRials: x.priceRials, sourceType: x.sourceType, confidence: x.confidence })),
      at: query.data.year && at !== null ? { year: query.data.year, month: query.data.month ?? null, priceRials: at.toString() } : null,
    };
    return body;
  });
}
