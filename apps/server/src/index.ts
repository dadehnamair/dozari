import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { resolve } from 'node:path';
import { rialsToTomanString } from '@dozari/shared';
import { createDb } from '@dozari/db';
import { createDbCatalogRepository } from './catalog/db-repository.js';
import { createDbAdminRepository } from './admin/db-repository.js';
import { registerAdminRoutes } from './admin/routes.js';
import type { AdminRepository } from './admin/routes.js';
import { registerCatalogRoutes } from './catalog/routes.js';
import { isMainModule } from './is-main.js';
import { createDbPuzzleSource } from './solo/db-source.js';
import { registerSoloRoutes } from './solo/routes.js';
import { SoloService } from './solo/service.js';
import type { CatalogRepository } from './catalog/routes.js';

export interface ServerDeps {
  catalog?: CatalogRepository;
  /** Interim catalog review page + API at `/admin`; registered only when a token is provided. */
  admin?: { repo: AdminRepository; token: string };
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
  if (deps.catalog) registerCatalogRoutes(app, deps.catalog);
  if (deps.solo) registerSoloRoutes(app, deps.solo);
  if (deps.admin) registerAdminRoutes(app, deps.admin.repo, deps.admin.token);
  if (deps.localImagesDir) {
    void app.register(fastifyStatic, { root: resolve(deps.localImagesDir), prefix: '/images/' });
  }

  return app;
}

if (isMainModule(import.meta.url)) {
  const db = process.env.DATABASE_URL ? createDb() : undefined;
  const adminToken = process.env.ADMIN_TOKEN;
  const app = buildServer({
    catalog: db ? createDbCatalogRepository(db) : undefined,
    solo: db ? new SoloService(createDbPuzzleSource(db)) : undefined,
    admin: db && adminToken ? { repo: createDbAdminRepository(db), token: adminToken } : undefined,
    corsOrigin: process.env.CORS_ORIGIN,
    localImagesDir: process.env.LOCAL_IMAGES_DIR,
  });
  const port = Number(process.env.PORT ?? 3000);
  app.listen({ port, host: '0.0.0.0' }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
