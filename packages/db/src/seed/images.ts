import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'minio';
import { eq } from 'drizzle-orm';
import type { SeedProduct } from '@dozari/shared';
import type { Db } from '../client.js';
import { productImages, products } from '../schema.js';

export const IMAGES_DIR = fileURLToPath(new URL('../../seed/images', import.meta.url));

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** Object key for a seed image: stable per (slug, file) so re-uploads overwrite in place. */
export function imageObjectKey(slug: string, file: string): string {
  return `products/${slug}/${file}`;
}

export function imagePublicUrl(publicBaseUrl: string, key: string): string {
  return `${publicBaseUrl.replace(/\/+$/, '')}/${key}`;
}

export function imageContentType(file: string): string | undefined {
  return CONTENT_TYPES[extname(file).toLowerCase()];
}

export interface S3Config {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  publicBaseUrl: string;
}

export function s3ConfigFromEnv(env: NodeJS.ProcessEnv = process.env): S3Config {
  const need = (k: string) => {
    const v = env[k];
    if (!v) throw new Error(`${k} is required`);
    return v;
  };
  return {
    endpoint: need('S3_ENDPOINT'),
    accessKey: need('S3_ACCESS_KEY'),
    secretKey: need('S3_SECRET_KEY'),
    bucket: need('S3_BUCKET'),
    publicBaseUrl: need('S3_PUBLIC_BASE_URL'),
  };
}

/** Where uploaded images go. `put` stores the bytes; `publicUrl` is what `product_images.url` holds. */
export interface ImageStore {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  publicUrl(key: string): string;
}

export function createS3ImageStore(cfg: S3Config): ImageStore {
  const endpoint = new URL(cfg.endpoint);
  const client = new Client({
    endPoint: endpoint.hostname,
    port: endpoint.port ? Number(endpoint.port) : endpoint.protocol === 'https:' ? 443 : 80,
    useSSL: endpoint.protocol === 'https:',
    accessKey: cfg.accessKey,
    secretKey: cfg.secretKey,
  });
  let bucketReady: Promise<void> | undefined;
  const ensureBucket = () =>
    (bucketReady ??= (async () => {
      if (!(await client.bucketExists(cfg.bucket))) await client.makeBucket(cfg.bucket);
    })());
  return {
    async put(key, body, contentType) {
      await ensureBucket();
      await client.putObject(cfg.bucket, key, body, undefined, { 'Content-Type': contentType });
    },
    publicUrl: (key) => imagePublicUrl(cfg.publicBaseUrl, key),
  };
}

/** Docker-free dev store: writes under `dir`, served by the API at `${publicBaseUrl}/<key>`. */
export function createLocalImageStore(dir: string, publicBaseUrl: string): ImageStore {
  return {
    async put(key, body) {
      const target = join(dir, key);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, body);
    },
    publicUrl: (key) => imagePublicUrl(publicBaseUrl, key),
  };
}

/** S3 when `S3_ENDPOINT` is set (MinIO / ArvanCloud), otherwise local disk (`LOCAL_IMAGES_DIR`). */
export function imageStoreFromEnv(env: NodeJS.ProcessEnv = process.env): ImageStore {
  if (env.S3_ENDPOINT) return createS3ImageStore(s3ConfigFromEnv(env));
  const dir = env.LOCAL_IMAGES_DIR;
  if (!dir) throw new Error('Set S3_ENDPOINT (+ S3_*) or LOCAL_IMAGES_DIR for image storage');
  return createLocalImageStore(dir, env.LOCAL_IMAGES_PUBLIC_URL ?? 'http://localhost:3000/images');
}

/**
 * Uploads every seed image found in `seed/images/` to the image store and upserts its
 * `product_images` row. Idempotent: same key, same (product, url) row.
 * Images listed in the seed but missing on disk are reported and skipped.
 */
export async function uploadSeedImages(
  db: Db,
  seed: readonly SeedProduct[],
  store: ImageStore,
  dir: string = IMAGES_DIR,
) {
  const result = { uploaded: 0, missing: [] as string[] };
  for (const product of seed) {
    if (product.images.length === 0) continue;
    const [row] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, product.slug));
    if (!row) throw new Error(`product ${product.slug} not in DB — run \`seed\` first`);

    for (const img of product.images) {
      const contentType = imageContentType(img.file);
      if (!contentType) throw new Error(`${product.slug}: unsupported image type ${img.file}`);
      const path = join(dir, img.file);
      if (!existsSync(path)) {
        result.missing.push(`${product.slug}/${img.file}`);
        continue;
      }
      const key = imageObjectKey(product.slug, img.file);
      await store.put(key, readFileSync(path), contentType);
      const values = {
        productId: row.id,
        url: store.publicUrl(key),
        yearFrom: img.year_from ?? null,
        yearTo: img.year_to ?? null,
        isPrimary: img.is_primary,
        credit: img.credit ?? null,
      };
      await db
        .insert(productImages)
        .values(values)
        .onConflictDoUpdate({
          target: [productImages.productId, productImages.url],
          set: values,
        });
      result.uploaded++;
    }
  }
  return result;
}
