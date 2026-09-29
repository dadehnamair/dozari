import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createLocalImageStore,
  imageContentType,
  imageObjectKey,
  imagePublicUrl,
  imageStoreFromEnv,
  s3ConfigFromEnv,
} from '../images.js';

describe('seed image helpers', () => {
  it('builds stable keys and public URLs', () => {
    const key = imageObjectKey('peykan-javanan', 'peykan-1360.jpg');
    expect(key).toBe('products/peykan-javanan/peykan-1360.jpg');
    expect(imagePublicUrl('http://localhost:9000/dozari-images/', key)).toBe(
      'http://localhost:9000/dozari-images/products/peykan-javanan/peykan-1360.jpg',
    );
  });

  it('maps known extensions and rejects unknown ones', () => {
    expect(imageContentType('a.JPG')).toBe('image/jpeg');
    expect(imageContentType('a.webp')).toBe('image/webp');
    expect(imageContentType('a.gif')).toBeUndefined();
  });

  it('requires all S3 env vars', () => {
    expect(() => s3ConfigFromEnv({})).toThrow('S3_ENDPOINT');
  });

  it('picks the store from env: S3 first, then local disk, else error', () => {
    expect(() => imageStoreFromEnv({})).toThrow('LOCAL_IMAGES_DIR');
    const local = imageStoreFromEnv({ LOCAL_IMAGES_DIR: '/tmp/x' });
    expect(local.publicUrl('products/a/b.jpg')).toBe('http://localhost:3000/images/products/a/b.jpg');
    expect(() => imageStoreFromEnv({ S3_ENDPOINT: 'http://localhost:9000' })).toThrow('S3_ACCESS_KEY');
  });

  it('local store writes under its directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dozari-img-'));
    try {
      await createLocalImageStore(dir, 'http://x/images').put('products/a/b.jpg', Buffer.from('hi'), 'image/jpeg');
      expect(readFileSync(join(dir, 'products/a/b.jpg'), 'utf8')).toBe('hi');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
