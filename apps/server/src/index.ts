import Fastify from 'fastify';
import { rialsToTomanString } from '@dozari/shared';
import { createDb } from '@dozari/db';
import { createDbCatalogRepository } from './catalog/db-repository.js';
import { registerCatalogRoutes } from './catalog/routes.js';
import type { CatalogRepository } from './catalog/routes.js';

export interface ServerDeps {
  catalog?: CatalogRepository;
}

export function buildServer(deps: ServerDeps = {}) {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({
    status: 'ok',
    // proves apps/server -> packages/shared wiring at boot, not real game logic yet.
    sample: rialsToTomanString(1_500),
  }));

  if (deps.catalog) registerCatalogRoutes(app, deps.catalog);

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = buildServer({
    catalog: process.env.DATABASE_URL
      ? createDbCatalogRepository(createDb())
      : undefined,
  });
  const port = Number(process.env.PORT ?? 3000);
  app.listen({ port, host: '0.0.0.0' }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
