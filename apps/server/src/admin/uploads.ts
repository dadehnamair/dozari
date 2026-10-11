import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ImageStore } from '@dozari/db';

/** 5 MB is plenty for a banner or a cover; the panel shrinks nothing, so this is the real ceiling. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Where an upload may live: a closed list, so a request can never pick an arbitrary object key. */
export const UPLOAD_FOLDERS = ['sponsors', 'landing', 'products', 'misc'] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export const UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** The real type from the first bytes: the `content-type` header is only a claim. */
export function sniffImageType(b: Buffer): (typeof UPLOAD_TYPES)[number] | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/**
 * `POST /admin/uploads?folder=sponsors` with the raw image as the body (`content-type: image/png|jpeg|webp`).
 * Answers `{ url }`, the public address to paste into any image field of the panel.
 * Registered inside the guarded admin scope, so the token and role check already ran.
 */
export function registerAdminUploadRoutes(g: FastifyInstance, store: ImageStore, audit: (action: string, target: string, detail?: string) => void) {
  // Raw bodies, no multipart dependency. Only these three types; anything else is a 415 from Fastify.
  g.addContentTypeParser([...UPLOAD_TYPES], { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_BYTES }, (_req, body, done) => done(null, body));

  g.post<{ Querystring: { folder?: string } }>('/admin/uploads', { bodyLimit: MAX_UPLOAD_BYTES }, async (req, reply) => {
    const folder = (UPLOAD_FOLDERS as readonly string[]).includes(req.query.folder ?? '') ? (req.query.folder as UploadFolder) : null;
    if (!folder) return reply.code(400).send({ error: 'invalid_folder' });
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) return reply.code(400).send({ error: 'invalid_request' });
    const type = sniffImageType(body);
    if (!type) return reply.code(415).send({ error: 'unsupported_image' });
    const key = `uploads/${folder}/${randomUUID()}.${EXT[type]}`;
    await store.put(key, body, type);
    const url = store.publicUrl(key);
    audit('upload.image', key, `${body.length} bytes`);
    return reply.code(201).send({ url });
  });
}
