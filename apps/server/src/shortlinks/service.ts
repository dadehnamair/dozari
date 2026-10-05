import { randomInt } from 'node:crypto';
import type { ShortLinkRow, ShortLinkStore } from './store.js';

/** Codes that would collide with real routes on a host that serves both. */
const RESERVED = new Set(['admin', 'api', 'health', 'config', 'auth', 's', 'robots.txt', 'sitemap.xml', 'favicon.ico', 'llms.txt', 'images']);
const CODE = /^[a-z0-9][a-z0-9_-]{0,22}[a-z0-9]$/;
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

export type CreateResult = { ok: true; code: string } | { ok: false; error: 'invalid_url' | 'invalid_code' | 'reserved' | 'taken' | 'self_link' };

/** A web address a short link may point to: http(s) only, no credentials, a sane length. */
export function cleanTarget(raw: string): string | null {
  const text = raw.trim();
  if (text.length > 1000) return null;
  try {
    const u = new URL(text);
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

const randomCode = (): string => Array.from({ length: 6 }, () => ALPHABET[randomInt(0, ALPHABET.length)]).join('');

/** Short links of the `2oi.ir` domain (D172): admin-made, counted, switchable off, never pointing back at the short domain. */
export class ShortLinkService {
  constructor(
    private readonly store: ShortLinkStore,
    /** The short domain from the admin settings (may be empty), used to refuse loops. */
    private readonly shortHost: () => Promise<string>,
  ) {}

  async create(targetRaw: string, wantedCode: string | undefined, note: string): Promise<CreateResult> {
    const target = cleanTarget(targetRaw);
    if (!target) return { ok: false, error: 'invalid_url' };
    const host = (await this.shortHost()).trim().toLowerCase();
    if (host && new URL(target).hostname.toLowerCase() === host) return { ok: false, error: 'self_link' };
    if (wantedCode !== undefined && wantedCode !== '') {
      const code = wantedCode.trim().toLowerCase();
      if (!CODE.test(code)) return { ok: false, error: 'invalid_code' };
      if (RESERVED.has(code)) return { ok: false, error: 'reserved' };
      return (await this.store.create(code, target, note)) === 'ok' ? { ok: true, code } : { ok: false, error: 'taken' };
    }
    for (let i = 0; i < 8; i++) {
      const code = randomCode();
      if (!RESERVED.has(code) && (await this.store.create(code, target, note)) === 'ok') return { ok: true, code };
    }
    return { ok: false, error: 'taken' };
  }

  /** The address to redirect to, or null (unknown, switched off). Counts the click. */
  async resolve(codeRaw: string): Promise<string | null> {
    const code = codeRaw.trim().toLowerCase();
    if (!CODE.test(code)) return null;
    const row = await this.store.get(code);
    if (!row || !row.isActive) return null;
    void this.store.click(code).catch(() => undefined);
    return row.targetUrl;
  }

  admin = {
    list: (limit = 200): Promise<ShortLinkRow[]> => this.store.list(limit),
    update: (code: string, patch: Partial<Pick<ShortLinkRow, 'targetUrl' | 'note' | 'isActive'>>) => this.store.update(code, patch),
  };
}
