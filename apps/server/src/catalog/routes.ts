import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

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
}

export interface PricePointDto {
  year: number;
  month: number | null;
  /** Integer rials as a decimal string (BIGINT is not JSON-safe). Nominal, never adjusted. */
  priceRials: string;
  sourceType: string;
  confidence: number;
}

/** I/O boundary so routes are testable without Postgres. */
export interface CatalogRepository {
  getProduct(id: string): Promise<ProductDto | null>;
  /** Approved points only, ordered by year then month. */
  listApprovedPrices(productId: string): Promise<PricePointDto[]>;
}

const paramsSchema = z.object({ id: z.string().uuid() });

export function registerCatalogRoutes(app: FastifyInstance, repo: CatalogRepository) {
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
