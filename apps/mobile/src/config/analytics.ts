/**
 * Self-hosted analytics for the web build (Umami style): when the admin sets `analytics.script_url` and `analytics.site_id`,
 * the script is added once. Native builds and an empty setting do nothing; nothing here talks to Google.
 */
export function analyticsFrom(settings: Record<string, unknown>): { scriptUrl: string; siteId: string } | null {
  const url = typeof settings['analytics.script_url'] === 'string' ? settings['analytics.script_url'].trim() : '';
  const id = typeof settings['analytics.site_id'] === 'string' ? settings['analytics.site_id'].trim() : '';
  return /^https:\/\//i.test(url) && /^[A-Za-z0-9_-]{4,100}$/.test(id) ? { scriptUrl: url, siteId: id } : null;
}

let installed = false;

export function installAnalytics(settings: Record<string, unknown>): void {
  const a = analyticsFrom(settings);
  const doc = (globalThis as { document?: { createElement(t: string): { defer: boolean; src: string; setAttribute(k: string, v: string): void }; head: { appendChild(n: unknown): void } } }).document;
  if (!a || !doc || installed) return;
  installed = true;
  const s = doc.createElement('script');
  s.defer = true;
  s.src = a.scriptUrl;
  s.setAttribute('data-website-id', a.siteId);
  doc.head.appendChild(s);
}
