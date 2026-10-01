import { asc, blockedWords, eq } from '@dozari/db';
import type { Db } from '@dozari/db';
import { filterText } from '@dozari/shared';
import type { FilterResult, FilterWord, WordSeverity } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';

export interface WordRow extends FilterWord {
  id: string;
}

/** Where the list lives; the DB in production, memory in tests. */
export interface WordStore {
  list(): Promise<WordRow[]>;
  add(word: string, severity: WordSeverity): Promise<{ id: string } | 'duplicate'>;
  setSeverity(id: string, severity: WordSeverity): Promise<'ok' | 'not_found'>;
  remove(id: string): Promise<'ok' | 'not_found'>;
}

const CACHE_MS = 5_000;

/** The one gate every player-typed text goes through before it is accepted or shown (server side, D69). */
export class TextFilterService {
  private cache: { at: number; words: WordRow[] } | null = null;

  constructor(
    private readonly store: WordStore,
    private readonly now: () => number = Date.now,
  ) {}

  private async words(): Promise<WordRow[]> {
    if (this.cache && this.now() - this.cache.at < CACHE_MS) return this.cache.words;
    const words = await this.store.list();
    this.cache = { at: this.now(), words };
    return words;
  }

  /** `ok:false` means reject the text with a friendly notice; `ok:true` carries the (possibly masked) text to use. */
  async check(text: string): Promise<FilterResult> {
    return filterText(text, await this.words());
  }

  list(): Promise<WordRow[]> {
    return this.store.list();
  }

  async add(word: string, severity: WordSeverity) {
    const out = await this.store.add(word.trim(), severity);
    this.cache = null;
    return out;
  }

  async setSeverity(id: string, severity: WordSeverity) {
    const out = await this.store.setSeverity(id, severity);
    this.cache = null;
    return out;
  }

  async remove(id: string) {
    const out = await this.store.remove(id);
    this.cache = null;
    return out;
  }
}

function isDuplicateKey(err: unknown): boolean {
  const e = err as { code?: string; errno?: number; cause?: unknown } | null;
  return Boolean(e && (e.code === 'ER_DUP_ENTRY' || e.errno === 1062 || isDuplicateKey(e.cause)));
}

export function createDbWordStore(db: Db): WordStore {
  return {
    async list() {
      const rows = await db.select().from(blockedWords).orderBy(asc(blockedWords.word));
      return rows.map((r) => ({ id: r.id, word: r.word, severity: r.severity }));
    },
    async add(word, severity) {
      const id = uuidv7();
      try {
        await db.insert(blockedWords).values({ id, word, severity });
      } catch (err) {
        if (isDuplicateKey(err)) return 'duplicate';
        throw err;
      }
      return { id };
    },
    async setSeverity(id, severity) {
      const [row] = await db.select({ id: blockedWords.id }).from(blockedWords).where(eq(blockedWords.id, id));
      if (!row) return 'not_found';
      await db.update(blockedWords).set({ severity }).where(eq(blockedWords.id, id));
      return 'ok';
    },
    async remove(id) {
      const [row] = await db.select({ id: blockedWords.id }).from(blockedWords).where(eq(blockedWords.id, id));
      if (!row) return 'not_found';
      await db.delete(blockedWords).where(eq(blockedWords.id, id));
      return 'ok';
    },
  };
}

export function createMemoryWordStore(): WordStore {
  const rows: WordRow[] = [];
  return {
    async list() {
      return rows.map((r) => ({ ...r }));
    },
    async add(word, severity) {
      if (rows.some((r) => r.word === word)) return 'duplicate';
      const id = uuidv7();
      rows.push({ id, word, severity });
      return { id };
    },
    async setSeverity(id, severity) {
      const r = rows.find((x) => x.id === id);
      if (!r) return 'not_found';
      r.severity = severity;
      return 'ok';
    },
    async remove(id) {
      const i = rows.findIndex((x) => x.id === id);
      if (i < 0) return 'not_found';
      rows.splice(i, 1);
      return 'ok';
    },
  };
}
