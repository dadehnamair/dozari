import { randomBytes } from 'node:crypto';

/**
 * Sends server errors to a Sentry-compatible collector you host yourself (GlitchTip, Sentry self-hosted); nothing goes to Google.
 * `SENTRY_DSN=https://<key>@errors.example.ir/<projectId>`. No SDK: one small envelope per error, a per-minute cap, and a send
 * failure is swallowed (reporting must never break the server). Only the error and the route name leave; no bodies, headers or users.
 */
export interface ParsedDsn {
  endpoint: string;
  key: string;
  dsn: string;
}

export function parseDsn(dsn: string | undefined): ParsedDsn | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const project = u.pathname.replace(/^\/+|\/+$/g, '');
    if (!/^https?:$/.test(u.protocol) || !u.username || !/^\d+$/.test(project)) return null;
    return { endpoint: `${u.protocol}//${u.host}/api/${project}/envelope/`, key: u.username, dsn };
  } catch {
    return null;
  }
}

type Fetch = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<unknown>;

export interface ReporterOptions {
  dsn?: string;
  environment?: string;
  release?: string;
  /** Errors sent per minute at most (a crash loop must not flood the collector). */
  maxPerMinute?: number;
  fetcher?: Fetch;
  now?: () => number;
}

const FRAME = /^\s*at (?:(.*?) \()?(.*?):(\d+):(\d+)\)?$/;

/** Sentry wants frames oldest-first. */
function frames(stack: string | undefined): { function?: string; filename: string; lineno: number; colno: number }[] {
  const out: { function?: string; filename: string; lineno: number; colno: number }[] = [];
  for (const line of (stack ?? '').split('\n').slice(1)) {
    const m = FRAME.exec(line);
    if (m) out.push({ ...(m[1] ? { function: m[1] } : {}), filename: m[2] as string, lineno: Number(m[3]), colno: Number(m[4]) });
  }
  return out.reverse();
}

export function buildEnvelope(parsed: ParsedDsn, err: unknown, where: string | undefined, o: { environment?: string; release?: string; now: number }): string {
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'non-error thrown');
  const id = randomBytes(16).toString('hex');
  const event = {
    event_id: id,
    timestamp: o.now / 1000,
    platform: 'node',
    level: 'error',
    environment: o.environment ?? 'production',
    ...(o.release ? { release: o.release } : {}),
    ...(where ? { tags: { where } } : {}),
    exception: { values: [{ type: e.name, value: e.message.slice(0, 500), stacktrace: { frames: frames(e.stack) } }] },
  };
  return [JSON.stringify({ event_id: id, sent_at: new Date(o.now).toISOString(), dsn: parsed.dsn }), JSON.stringify({ type: 'event' }), JSON.stringify(event)].join('\n');
}

/** `report(err, where)`: fire and forget. A missing or invalid DSN gives a no-op. */
export function createErrorReporter(opts: ReporterOptions = {}): (err: unknown, where?: string) => void {
  const parsed = parseDsn(opts.dsn);
  if (!parsed) return () => undefined;
  const now = opts.now ?? Date.now;
  const cap = opts.maxPerMinute ?? 20;
  const send = opts.fetcher ?? ((url, init) => fetch(url, init));
  let windowStart = 0;
  let sent = 0;
  return (err, where) => {
    const t = now();
    if (t - windowStart >= 60_000) {
      windowStart = t;
      sent = 0;
    }
    if (sent >= cap) return;
    sent += 1;
    try {
      const body = buildEnvelope(parsed, err, where, { environment: opts.environment, release: opts.release, now: t });
      void Promise.resolve(send(parsed.endpoint, { method: 'POST', headers: { 'content-type': 'application/x-sentry-envelope', 'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${parsed.key}, sentry_client=dozari-server/1` }, body, signal: AbortSignal.timeout(5000) })).catch(() => undefined);
    } catch {
      /* reporting is best effort */
    }
  };
}
