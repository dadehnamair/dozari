import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** True for addresses a public website can never have: loopback, private, link-local, CGNAT, multicast, unspecified. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split('.').map(Number) as [number, number];
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0)
    );
  }
  const lower = ip.toLowerCase();
  return lower === '::' || lower === '::1' || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb') || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('ff');
}

export type Resolver = (host: string) => Promise<string[]>;
const defaultResolver: Resolver = async (host) => (await lookup(host, { all: true })).map((a) => a.address);

/**
 * SSRF guard for URLs an admin typed into the content bot: http(s) only, no credentials, and the host must resolve to
 * public addresses only. Throws with a short reason.
 */
export async function assertPublicHttpUrl(raw: string, resolve: Resolver = defaultResolver): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('invalid url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('only http(s) urls');
  if (url.username || url.password) throw new Error('credentials in url');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : await resolve(host).catch(() => []);
  if (addresses.length === 0) throw new Error('host does not resolve');
  if (addresses.some(isPrivateAddress)) throw new Error('private address');
  return url;
}

/** True for a plain http(s) URL (used to validate links before they are stored or shown). */
export function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
