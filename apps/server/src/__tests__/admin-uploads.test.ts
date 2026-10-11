import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { ImageStore } from '@dozari/db';
import { MAX_UPLOAD_BYTES, registerAdminUploadRoutes, sniffImageType } from '../admin/uploads.js';
import { permissionFor } from '../admin/accounts/permissions.js';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);

function build() {
  const puts: { key: string; type: string; size: number }[] = [];
  const store: ImageStore = { put: async (key, body, type) => void puts.push({ key, type, size: body.length }), publicUrl: (k) => `https://img.test/${k}` };
  const audits: string[] = [];
  const app = Fastify();
  registerAdminUploadRoutes(app, store, (a) => void audits.push(a));
  return { app, puts, audits };
}
const post = (app: ReturnType<typeof build>['app'], url: string, body: Buffer, type = 'image/png') => app.inject({ method: 'POST', url, headers: { 'content-type': type }, payload: body });

describe('admin image upload', () => {
  it('stores a real image under a generated key and returns its public url', async () => {
    const { app, puts, audits } = build();
    const res = await post(app, '/admin/uploads?folder=sponsors', PNG);
    expect(res.statusCode).toBe(201);
    expect(res.json().url).toMatch(/^https:\/\/img\.test\/uploads\/sponsors\/[0-9a-f-]{36}\.png$/);
    expect(puts).toHaveLength(1);
    expect(audits).toEqual(['upload.image']);
  });
  it('refuses an unknown folder', async () => {
    const { app, puts } = build();
    expect((await post(app, '/admin/uploads?folder=../etc', PNG)).statusCode).toBe(400);
    expect((await post(app, '/admin/uploads', PNG)).statusCode).toBe(400);
    expect(puts).toHaveLength(0);
  });
  it('refuses bytes that are not an image even when the header says so', async () => {
    const { app, puts } = build();
    expect((await post(app, '/admin/uploads?folder=misc', Buffer.from('<svg onload=alert(1)>'))).statusCode).toBe(415);
    expect(puts).toHaveLength(0);
  });
  it('refuses other content types and oversize bodies', async () => {
    const { app } = build();
    expect((await post(app, '/admin/uploads?folder=misc', PNG, 'image/svg+xml')).statusCode).toBe(415);
    expect((await post(app, '/admin/uploads?folder=misc', Buffer.concat([PNG, Buffer.alloc(MAX_UPLOAD_BYTES)]))).statusCode).toBe(413);
  });
  it('knows png, jpeg and webp by their first bytes', () => {
    expect(sniffImageType(PNG)).toBe('image/png');
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffImageType(Buffer.from('GIF89a......'))).toBeNull();
  });
  it('needs the content permission (editors can upload, viewers cannot)', () => {
    expect(permissionFor('POST', '/admin/uploads')).toBe('content');
  });
});
