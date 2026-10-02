import { and, asc, botRuns, contentSourceOptions, contentSources, desc, eq, inArray, priceCandidates, pricePoints, products } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';
import type { BOT_ADAPTER_KEYS } from './constants.js';
import type { RawCandidate } from './types.js';

export interface SourceRow {
  id: string;
  name: string;
  url: string;
  adapter: (typeof BOT_ADAPTER_KEYS)[number];
  sourceType: string;
  enabled: boolean;
  everyHours: number;
  lastRunAt: number | null;
  notes: string | null;
  options: Record<string, string>;
}

export interface SourceInput {
  name: string;
  url: string;
  adapter: (typeof BOT_ADAPTER_KEYS)[number];
  sourceType: string;
  enabled: boolean;
  everyHours: number;
  notes?: string | null;
  options: Record<string, string>;
}

export interface RunRow {
  id: string;
  sourceId: string | null;
  startedAt: number;
  finishedAt: number | null;
  status: string;
  foundCount: number;
  newCount: number;
  errorText: string | null;
}

export interface CandidateRow {
  id: string;
  sourceId: string | null;
  sourceName: string | null;
  productNameFa: string;
  unitFa: string | null;
  categoryGuess: string | null;
  productId: string | null;
  year: number;
  month: number | null;
  priceRials: string;
  sourceUrl: string;
  excerpt: string | null;
  confidence: number;
  status: string;
  createdAt: number;
}

export interface ApproveInput {
  /** Existing product to attach the price to; when absent a new product is created from `create`. */
  productId?: string;
  create?: { slug: string; nameFa: string; category: string; unitFa?: string | null; iconKey?: string | null };
}

export type ApproveOutcome = 'ok' | 'not_found' | 'already_decided' | 'conflict' | 'needs_product' | 'duplicate_slug';

export interface BotRepository {
  listSources(): Promise<SourceRow[]>;
  getSource(id: string): Promise<SourceRow | null>;
  createSource(input: SourceInput): Promise<string>;
  updateSource(id: string, input: Partial<SourceInput>): Promise<boolean>;
  deleteSource(id: string): Promise<boolean>;
  markSourceRun(id: string, at: Date): Promise<void>;
  startRun(sourceId: string | null, at: Date): Promise<string>;
  finishRun(id: string, patch: { status: 'ok' | 'failed'; foundCount: number; newCount: number; errorText?: string; at: Date }): Promise<void>;
  listRuns(limit: number): Promise<RunRow[]>;
  /** Inserts the new ones as pending (existing dedupe keys are skipped); returns how many were new. */
  addCandidates(runId: string, source: SourceRow, items: { raw: RawCandidate; dedupeKey: string }[]): Promise<number>;
  listCandidates(status: string, limit: number): Promise<CandidateRow[]>;
  approve(candidateId: string, input: ApproveInput): Promise<ApproveOutcome>;
  reject(candidateId: string): Promise<'ok' | 'not_found' | 'already_decided'>;
}

function isDuplicateKey(err: unknown): boolean {
  const e = err as { code?: string; errno?: number; cause?: unknown } | null;
  return Boolean(e && (e.code === 'ER_DUP_ENTRY' || e.errno === 1062 || isDuplicateKey(e.cause)));
}

export function createDbBotRepository(db: Db): BotRepository {
  async function optionsOf(ids: string[]): Promise<Map<string, Record<string, string>>> {
    const map = new Map<string, Record<string, string>>();
    if (ids.length === 0) return map;
    const rows = await db.select().from(contentSourceOptions).where(inArray(contentSourceOptions.sourceId, ids));
    for (const r of rows) map.set(r.sourceId, { ...(map.get(r.sourceId) ?? {}), [r.key]: r.value });
    return map;
  }
  const toRow = (s: typeof contentSources.$inferSelect, options: Record<string, string>): SourceRow => ({
    id: s.id,
    name: s.name,
    url: s.url,
    adapter: s.adapter,
    sourceType: s.sourceType,
    enabled: s.enabled,
    everyHours: s.everyHours,
    lastRunAt: s.lastRunAt?.getTime() ?? null,
    notes: s.notes,
    options,
  });
  async function writeOptions(sourceId: string, options: Record<string, string>) {
    await db.delete(contentSourceOptions).where(eq(contentSourceOptions.sourceId, sourceId));
    const rows = Object.entries(options).filter(([, v]) => v !== '').map(([key, value]) => ({ sourceId, key, value }));
    if (rows.length > 0) await db.insert(contentSourceOptions).values(rows);
  }

  return {
    async listSources() {
      const rows = await db.select().from(contentSources).orderBy(asc(contentSources.name));
      const opts = await optionsOf(rows.map((r) => r.id));
      return rows.map((r) => toRow(r, opts.get(r.id) ?? {}));
    },
    async getSource(id) {
      const [row] = await db.select().from(contentSources).where(eq(contentSources.id, id));
      if (!row) return null;
      return toRow(row, (await optionsOf([id])).get(id) ?? {});
    },
    async createSource(input) {
      const id = uuidv7();
      await db.insert(contentSources).values({
        id,
        name: input.name,
        url: input.url,
        adapter: input.adapter,
        sourceType: input.sourceType as (typeof contentSources.$inferInsert)['sourceType'],
        enabled: input.enabled,
        everyHours: input.everyHours,
        notes: input.notes ?? null,
      });
      await writeOptions(id, input.options);
      return id;
    },
    async updateSource(id, input) {
      const [row] = await db.select({ id: contentSources.id }).from(contentSources).where(eq(contentSources.id, id));
      if (!row) return false;
      const { options, ...rest } = input;
      const set = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
      if (Object.keys(set).length > 0) await db.update(contentSources).set(set).where(eq(contentSources.id, id));
      if (options) await writeOptions(id, options);
      return true;
    },
    async deleteSource(id) {
      const [row] = await db.select({ id: contentSources.id }).from(contentSources).where(eq(contentSources.id, id));
      if (!row) return false;
      await db.delete(contentSources).where(eq(contentSources.id, id));
      return true;
    },
    async markSourceRun(id, at) {
      await db.update(contentSources).set({ lastRunAt: at }).where(eq(contentSources.id, id));
    },
    async startRun(sourceId, at) {
      const id = uuidv7();
      await db.insert(botRuns).values({ id, sourceId, startedAt: at, status: 'running' });
      return id;
    },
    async finishRun(id, patch) {
      await db
        .update(botRuns)
        .set({ status: patch.status, foundCount: patch.foundCount, newCount: patch.newCount, errorText: patch.errorText ?? null, finishedAt: patch.at })
        .where(eq(botRuns.id, id));
    },
    async listRuns(limit) {
      const rows = await db.select().from(botRuns).orderBy(desc(botRuns.startedAt)).limit(limit);
      return rows.map((r) => ({
        id: r.id,
        sourceId: r.sourceId,
        startedAt: r.startedAt.getTime(),
        finishedAt: r.finishedAt?.getTime() ?? null,
        status: r.status,
        foundCount: r.foundCount,
        newCount: r.newCount,
        errorText: r.errorText,
      }));
    },
    async addCandidates(runId, source, items) {
      if (items.length === 0) return 0;
      const names = [...new Set(items.map((i) => i.raw.productNameFa))];
      const known = await db.select({ id: products.id, nameFa: products.nameFa }).from(products).where(inArray(products.nameFa, names));
      const byName = new Map(known.map((p) => [p.nameFa, p.id]));
      let added = 0;
      for (const { raw, dedupeKey } of items) {
        try {
          await db.insert(priceCandidates).values({
            id: uuidv7(),
            runId,
            sourceId: source.id,
            productNameFa: raw.productNameFa,
            unitFa: raw.unitFa ?? null,
            categoryGuess: (raw.categoryGuess as (typeof priceCandidates.$inferInsert)['categoryGuess']) ?? null,
            productId: byName.get(raw.productNameFa) ?? null,
            year: raw.year,
            month: raw.month ?? null,
            priceRials: raw.priceRials,
            sourceUrl: source.url,
            excerpt: raw.excerpt,
            confidence: 2,
            status: 'pending',
            dedupeKey,
          });
          added++;
        } catch (err) {
          if (!isDuplicateKey(err)) throw err;
        }
      }
      return added;
    },
    async listCandidates(status, limit) {
      const rows = await db
        .select({ c: priceCandidates, sourceName: contentSources.name })
        .from(priceCandidates)
        .leftJoin(contentSources, eq(contentSources.id, priceCandidates.sourceId))
        .where(eq(priceCandidates.status, status as 'pending' | 'approved' | 'rejected'))
        .orderBy(desc(priceCandidates.createdAt))
        .limit(limit);
      return rows.map(({ c, sourceName }) => ({
        id: c.id,
        sourceId: c.sourceId,
        sourceName,
        productNameFa: c.productNameFa,
        unitFa: c.unitFa,
        categoryGuess: c.categoryGuess,
        productId: c.productId,
        year: c.year,
        month: c.month,
        priceRials: c.priceRials.toString(),
        sourceUrl: c.sourceUrl,
        excerpt: c.excerpt,
        confidence: c.confidence,
        status: c.status,
        createdAt: c.createdAt.getTime(),
      }));
    },
    async approve(candidateId, input) {
      return db.transaction(async (tx) => {
        const [c] = await tx.select().from(priceCandidates).where(eq(priceCandidates.id, candidateId)).for('update');
        if (!c) return 'not_found';
        if (c.status !== 'pending') return 'already_decided';
        const [src] = c.sourceId ? await tx.select().from(contentSources).where(eq(contentSources.id, c.sourceId)) : [];
        let productId = input.productId ?? c.productId ?? undefined;
        if (!productId) {
          if (!input.create) return 'needs_product';
          productId = uuidv7();
          try {
            await tx.insert(products).values({
              id: productId,
              slug: input.create.slug,
              nameFa: input.create.nameFa,
              category: input.create.category as (typeof products.$inferInsert)['category'],
              unitFa: input.create.unitFa ?? c.unitFa ?? null,
              iconKey: input.create.iconKey ?? null,
            });
          } catch (err) {
            if (isDuplicateKey(err)) return 'duplicate_slug';
            throw err;
          }
        }
        try {
          await tx.insert(pricePoints).values({
            id: uuidv7(),
            productId,
            year: c.year,
            month: c.month,
            priceRials: c.priceRials,
            sourceType: src?.sourceType ?? 'website',
            sourceUrl: c.sourceUrl,
            sourceNote: c.excerpt,
            confidence: c.confidence,
            status: 'approved',
          });
        } catch (err) {
          if (isDuplicateKey(err)) return 'conflict';
          throw err;
        }
        await tx.update(priceCandidates).set({ status: 'approved', productId, reviewedAt: new Date() }).where(eq(priceCandidates.id, candidateId));
        return 'ok';
      });
    },
    async reject(candidateId) {
      const [c] = await db.select().from(priceCandidates).where(eq(priceCandidates.id, candidateId));
      if (!c) return 'not_found';
      if (c.status !== 'pending') return 'already_decided';
      await db.update(priceCandidates).set({ status: 'rejected', reviewedAt: new Date() }).where(and(eq(priceCandidates.id, candidateId), eq(priceCandidates.status, 'pending')));
      return 'ok';
    },
  };
}
