import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { buildEnvelope, createErrorReporter, parseDsn } from '../errors/report.js';

const DSN = 'https://abc123@errors.example.ir/7';

describe('error reporter (Sentry-compatible, self-hosted)', () => {
  it('parses a DSN and refuses nonsense', () => {
    expect(parseDsn(DSN)).toEqual({ endpoint: 'https://errors.example.ir/api/7/envelope/', key: 'abc123', dsn: DSN });
    expect(parseDsn('http://k@host:9000/12')?.endpoint).toBe('http://host:9000/api/12/envelope/');
    for (const bad of [undefined, '', 'not a url', 'https://errors.example.ir/7', 'https://k@errors.example.ir/abc', 'ftp://k@h/1']) expect(parseDsn(bad)).toBeNull();
  });

  it('builds a three-line envelope with the error, its frames oldest first and the route, and nothing else', () => {
    const parsed = parseDsn(DSN)!;
    const err = new Error('boom');
    err.stack = 'Error: boom\n    at inner (/app/a.ts:10:5)\n    at outer (/app/b.ts:20:7)\n    at /app/c.ts:30:1';
    const [header, item, event] = buildEnvelope(parsed, err, 'GET /x', { environment: 'production', release: 'r1', now: 1_700_000_000_000 }).split('\n').map((l) => JSON.parse(l));
    expect(header).toMatchObject({ dsn: DSN, sent_at: '2023-11-14T22:13:20.000Z' });
    expect(item).toEqual({ type: 'event' });
    expect(event).toMatchObject({ platform: 'node', level: 'error', release: 'r1', tags: { where: 'GET /x' }, timestamp: 1_700_000_000 });
    expect(event.exception.values[0]).toMatchObject({ type: 'Error', value: 'boom' });
    expect(event.exception.values[0].stacktrace.frames.map((f: { lineno: number }) => f.lineno)).toEqual([30, 20, 10]);
    expect(Object.keys(event).sort()).toEqual(['environment', 'event_id', 'exception', 'level', 'platform', 'release', 'tags', 'timestamp']);
  });

  it('posts with the key header, caps the rate per minute, and never throws when sending fails', async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    let t = 0;
    const report = createErrorReporter({ dsn: DSN, maxPerMinute: 2, now: () => t, fetcher: async (url, init) => void calls.push({ url, headers: init.headers }) });
    report(new Error('a'));
    report(new Error('b'));
    report(new Error('c'));
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe('https://errors.example.ir/api/7/envelope/');
    expect(calls[0]?.headers['x-sentry-auth']).toContain('sentry_key=abc123');
    t = 61_000;
    report(new Error('d'));
    expect(calls).toHaveLength(3);

    const failing = createErrorReporter({ dsn: DSN, fetcher: async () => { throw new Error('collector down'); } });
    expect(() => failing('plain string')).not.toThrow();
    expect(() => createErrorReporter({})(new Error('x'))).not.toThrow();
  });

  it('is called for a 500 with the route, not for a client error', async () => {
    const seen: { err: unknown; where?: string }[] = [];
    const app = buildServer({ reportError: (err, where) => void seen.push({ err, where }) });
    app.get('/boom', async () => { throw new Error('db exploded'); });
    app.get('/bad', async (_req, reply) => reply.code(400).send({ error: 'x' }));
    expect((await app.inject({ method: 'GET', url: '/boom' })).statusCode).toBe(500);
    await app.inject({ method: 'GET', url: '/bad' });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.where).toBe('GET /boom');
  });
});
