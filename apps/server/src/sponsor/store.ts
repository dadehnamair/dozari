import { desc, eq, sponsors } from '@dozari/db';
import type { Db } from '@dozari/db';
import type { Sponsor } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';

export interface SponsorRow extends Sponsor {
  isActive: boolean;
}
export type SponsorInput = Omit<SponsorRow, 'id'>;

/** I/O boundary of sponsors (docs/logic/sponsors.md). */
export interface SponsorStore {
  create(input: SponsorInput): Promise<SponsorRow>;
  update(id: string, patch: Partial<SponsorInput>): Promise<'ok' | 'not_found'>;
  get(id: string): Promise<SponsorRow | null>;
  list(): Promise<SponsorRow[]>;
}

const toRow = (r: typeof sponsors.$inferSelect): SponsorRow => ({ id: r.id, nameFa: r.nameFa, taglineFa: r.taglineFa, descriptionFa: r.descriptionFa, bannerUrl: r.bannerUrl, logoUrl: r.logoUrl, linkUrl: r.linkUrl, accent: r.accent, isActive: r.isActive });

export function createDbSponsorStore(db: Db): SponsorStore {
  return {
    async create(input) {
      const id = uuidv7();
      await db.insert(sponsors).values({ id, ...input });
      const [r] = await db.select().from(sponsors).where(eq(sponsors.id, id));
      return toRow(r!);
    },
    async update(id, patch) {
      const [r] = await db.select({ id: sponsors.id }).from(sponsors).where(eq(sponsors.id, id));
      if (!r) return 'not_found';
      if (Object.keys(patch).length > 0) await db.update(sponsors).set(patch).where(eq(sponsors.id, id));
      return 'ok';
    },
    async get(id) {
      const [r] = await db.select().from(sponsors).where(eq(sponsors.id, id));
      return r ? toRow(r) : null;
    },
    async list() {
      return (await db.select().from(sponsors).orderBy(desc(sponsors.createdAt))).map(toRow);
    },
  };
}

/** Memory store for tests. */
export function createMemorySponsorStore(): SponsorStore {
  const rows = new Map<string, SponsorRow>();
  let seq = 0;
  return {
    async create(input) {
      const row = { ...input, id: `00000000-0000-7000-c000-${String(++seq).padStart(12, '0')}` };
      rows.set(row.id, row);
      return { ...row };
    },
    async update(id, patch) {
      const r = rows.get(id);
      if (!r) return 'not_found';
      Object.assign(r, patch);
      return 'ok';
    },
    async get(id) {
      const r = rows.get(id);
      return r ? { ...r } : null;
    },
    async list() {
      return [...rows.values()].reverse().map((r) => ({ ...r }));
    },
  };
}
