import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { resolve } from 'node:path';
import { rialsToTomanString } from '@dozari/shared';
import { createDb } from '@dozari/db';
import { createDbCatalogRepository } from './catalog/db-repository.js';
import { registerCatalogRoutes } from './catalog/routes.js';
import { isMainModule } from './is-main.js';
import type { CatalogRepository } from './catalog/routes.js';

export interface ServerDeps {
  catalog?: CatalogRepository;
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

  if (deps.catalog) registerCatalogRoutes(app, deps.catalog);
  if (deps.localImagesDir) {
    void app.register(fastifyStatic, { root: resolve(deps.localImagesDir), prefix: '/images/' });
  }

  return app;
}

if (isMainModule(import.meta.url)) {
  const app = buildServer({
    catalog: process.env.DATABASE_URL ? createDbCatalogRepository(createDb()) : undefined,
    localImagesDir: process.env.LOCAL_IMAGES_DIR,
  });
  const port = Number(process.env.PORT ?? 3000);
  app.listen({ port, host: '0.0.0.0' }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
