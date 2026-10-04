import { assertPublicHttpUrl } from '../security/url-guard.js';
import type { Resolver } from '../security/url-guard.js';

const FIELDS = ['short_url', 'shortUrl', 'short', 'result_url', 'shorturl', 'link', 'result', 'url'];
const isHttp = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\/\S+$/.test(v.trim());

/** Pulls the short link out of a shortener's answer: plain text that is a URL, or JSON with one of the usual field names (also one level deep). */
export function extractShortUrl(body: string): string | null {
  const text = body.trim();
  if (isHttp(text)) return text;
  try {
    const json: unknown = JSON.parse(text);
    const look = (o: unknown): string | null => {
      if (typeof o !== 'object' || o === null) return null;
      for (const f of FIELDS) {
        const v = (o as Record<string, unknown>)[f];
        if (isHttp(v)) return v.trim();
      }
      return null;
    };
    const top = look(json);
    if (top) return top;
    for (const v of Object.values(json as Record<string, unknown>)) {
      const nested = look(v);
      if (nested) return nested;
    }
  } catch {
    /* not JSON */
  }
  return null;
}

export interface Shortener {
  /** The short form of `url`, or `url` itself when no shortener is configured or it failed. Never throws. */
  shorten(url: string, template: string): Promise<string>;
}

/**
 * Calls the shortener the admin configured: `template` is a URL with `{url}` where the long link goes (GET). The target host must be
 * public (SSRF guard). Results are remembered, and a failure falls back to the long link so sharing never breaks.
 */
export function createShortener(opts: { fetchImpl?: typeof fetch; resolve?: Resolver } = {}): Shortener {
  const doFetch = opts.fetchImpl ?? fetch;
  const cache = new Map<string, string>();
  return {
    async shorten(url, template) {
      if (!template.includes('{url}')) return url;
      const key = `${template}\n${url}`;
      const hit = cache.get(key);
      if (hit) return hit;
      try {
        const target = template.replace('{url}', encodeURIComponent(url));
        await assertPublicHttpUrl(target, opts.resolve);
        const res = await doFetch(target, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(5_000), headers: { accept: 'application/json, text/plain' } });
        if (!res.ok) return url;
        const short = extractShortUrl((await res.text()).slice(0, 2000));
        if (!short) return url;
        if (cache.size > 2000) cache.clear();
        cache.set(key, short);
        return short;
      } catch {
        return url;
      }
    },
  };
}
