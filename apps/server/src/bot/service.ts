import { createHash } from 'node:crypto';
import { ADAPTERS } from './adapters.js';
import type { BotRepository, SourceRow } from './repository.js';
import type { RawCandidate } from './types.js';

export type Fetcher = (url: string) => Promise<string>;

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
const USER_AGENT = 'DozariContentBot/1.0 (price-history research; contact: site owner)';

/** Plain HTTP(S) fetch with a timeout and a size cap; only http(s) URLs. */
export const httpFetcher: Fetcher = async (url) => {
  if (!/^https?:\/\//i.test(url)) throw new Error('only http(s) urls');
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'text/html,text/csv,text/plain,*/*' }, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new Error('response too large');
  return new TextDecoder('utf-8').decode(buf);
};

export function dedupeKeyOf(c: RawCandidate, url: string): string {
  return createHash('sha256').update([c.productNameFa, c.year, c.month ?? 0, c.priceRials.toString(), url].join('|')).digest('hex').slice(0, 64);
}

export interface RunSummary {
  sourceId: string;
  name: string;
  status: 'ok' | 'failed';
  found: number;
  added: number;
  error?: string;
}

/**
 * The content bot. It reads configured sources, turns what it finds into pending candidates with the source URL and the
 * original line attached, and stops there: a human approves in the admin panel. It never writes approved prices itself.
 */
export class BotService {
  constructor(
    private readonly repo: BotRepository,
    private readonly fetchText: Fetcher = httpFetcher,
    private readonly now: () => number = Date.now,
  ) {}

  async runSource(source: SourceRow, maxCandidates: number): Promise<RunSummary> {
    const runId = await this.repo.startRun(source.id, new Date(this.now()));
    try {
      const body = await this.fetchText(source.url);
      const found = ADAPTERS[source.adapter]({ body, options: source.options });
      const limited = found.slice(0, maxCandidates);
      const added = await this.repo.addCandidates(
        runId,
        source,
        limited.map((raw) => ({ raw, dedupeKey: dedupeKeyOf(raw, source.url) })),
      );
      await this.repo.finishRun(runId, { status: 'ok', foundCount: found.length, newCount: added, at: new Date(this.now()) });
      await this.repo.markSourceRun(source.id, new Date(this.now()));
      return { sourceId: source.id, name: source.name, status: 'ok', found: found.length, added };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.repo.finishRun(runId, { status: 'failed', foundCount: 0, newCount: 0, errorText: message.slice(0, 500), at: new Date(this.now()) });
      await this.repo.markSourceRun(source.id, new Date(this.now()));
      return { sourceId: source.id, name: source.name, status: 'failed', found: 0, added: 0, error: message };
    }
  }

  async runOne(id: string, maxCandidates: number): Promise<RunSummary | null> {
    const source = await this.repo.getSource(id);
    return source ? this.runSource(source, maxCandidates) : null;
  }

  /** Every enabled source whose interval has passed. */
  async runDue(maxCandidates: number): Promise<RunSummary[]> {
    const sources = await this.repo.listSources();
    const due = sources.filter((s) => s.enabled && (s.lastRunAt === null || this.now() - s.lastRunAt >= s.everyHours * 3_600_000));
    const out: RunSummary[] = [];
    for (const s of due) out.push(await this.runSource(s, maxCandidates));
    return out;
  }
}
