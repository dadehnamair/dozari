import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { Db } from '../client.js';
import { landingCast, landingFaq, landingPosts } from '../schema.js';

export const LANDING_SEED_DIR = join(fileURLToPath(new URL('../../seed/landing', import.meta.url)));

const castSchema = z.array(z.object({ nameFa: z.string().min(1).max(80), roleFa: z.string().max(120).default(''), bioFa: z.string().min(1), imageKey: z.string().max(200).nullable().optional() }));
const faqSchema = z.array(z.object({ questionFa: z.string().min(1).max(200), answerFa: z.string().min(1) }));
const postsSchema = z.array(
  z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/).max(120),
    titleFa: z.string().min(1).max(160),
    summaryFa: z.string().max(400).default(''),
    bodyMd: z.string().min(1),
    metaTitle: z.string().max(70).nullable().optional(),
    metaDescription: z.string().max(200).nullable().optional(),
    coverUrl: z.string().max(300).nullable().optional(),
    authorName: z.string().max(80).default(''),
    status: z.enum(['draft', 'published']).default('published'),
  }),
);

export interface LandingSeed {
  cast: z.infer<typeof castSchema>;
  faq: z.infer<typeof faqSchema>;
  posts: z.infer<typeof postsSchema>;
}

const readJson = (dir: string, file: string): unknown => {
  const path = join(dir, file);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
};

/** Read + validate `seed/landing/{cast,faq,posts}.json` (a missing file means none). */
export function readSeedLanding(dir: string = LANDING_SEED_DIR): LandingSeed {
  return { cast: castSchema.parse(readJson(dir, 'cast.json')), faq: faqSchema.parse(readJson(dir, 'faq.json')), posts: postsSchema.parse(readJson(dir, 'posts.json')) };
}

/**
 * Insert-only and idempotent: a post is matched by slug, cast by name, FAQ by question. Rows that already exist
 * (possibly edited in the admin panel) are left untouched.
 */
export async function loadSeedLanding(db: Db, seed: LandingSeed = readSeedLanding(), now: Date = new Date()) {
  const have = {
    cast: new Set((await db.select({ k: landingCast.nameFa }).from(landingCast)).map((r) => r.k)),
    faq: new Set((await db.select({ k: landingFaq.questionFa }).from(landingFaq)).map((r) => r.k)),
  };
  const added = { posts: 0, cast: 0, faq: 0 };
  for (const [i, c] of seed.cast.filter((c) => !have.cast.has(c.nameFa)).entries()) {
    await db.insert(landingCast).values({ ...c, imageKey: c.imageKey ?? null, sortOrder: have.cast.size + i });
    added.cast++;
  }
  for (const [i, f] of seed.faq.filter((f) => !have.faq.has(f.questionFa)).entries()) {
    await db.insert(landingFaq).values({ ...f, sortOrder: have.faq.size + i });
    added.faq++;
  }
  for (const p of seed.posts) {
    const [res] = await db.insert(landingPosts).ignore().values({ ...p, publishedAt: p.status === 'published' ? now : null, createdAt: now, updatedAt: now });
    added.posts += res.affectedRows;
  }
  return added;
}
