import { describe, expect, it } from 'vitest';
import { imageContentType, imageObjectKey, imagePublicUrl, s3ConfigFromEnv } from '../images.js';

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
});
