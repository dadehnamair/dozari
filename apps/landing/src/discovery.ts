import type { LandingData, PostSummary } from './api.js';
import { plainText } from './markdown.js';
import { absolute } from './seo.js';
import type { Site } from './seo.js';

const xml = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string);
const iso = (ms: number): string => new Date(ms).toISOString();

/** `sitemap.xml`: every indexable page with its real last-modified time and `hreflang` alternates; noindex pages never appear. */
export function sitemap(site: Site, posts: PostSummary[]): string {
  const latest = posts.reduce((m, p) => Math.max(m, p.updatedAt), 0);
  const urls: { path: string; lastmod?: number }[] = [{ path: '/', lastmod: latest || undefined }, { path: '/blog', lastmod: latest || undefined }, { path: '/cast' }, ...posts.map((p) => ({ path: `/blog/${encodeURIComponent(p.slug)}`, lastmod: p.updatedAt }))];
  const entries = urls
    .map((u) => {
      const loc = xml(absolute(site, u.path));
      return `<url><loc>${loc}</loc>${u.lastmod ? `<lastmod>${iso(u.lastmod)}</lastmod>` : ''}<xhtml:link rel="alternate" hreflang="fa-IR" href="${loc}"/><xhtml:link rel="alternate" hreflang="x-default" href="${loc}"/></url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries}\n</urlset>\n`;
}

/** AI crawlers named explicitly so the permission is visible; nothing on this site is private. */
export const AI_AGENTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended'] as const;

export function robots(site: Site): string {
  const groups = ['*', ...AI_AGENTS].map((a) => `User-agent: ${a}\nAllow: /`).join('\n\n');
  return `${groups}\n\nSitemap: ${absolute(site, '/sitemap.xml')}\n`;
}

/** `llms.txt`: a compact, link-rich map of the site for answer engines (https://llmstxt.org). */
export function llmsTxt(site: Site, data: LandingData, posts: PostSummary[]): string {
  const lines = [`# ${site.name}`, '', `> ${data.site.heroText || site.tagline}`, '', '## صفحه‌های اصلی', `- [صفحه‌ی اول](${absolute(site, '/')}): معرفی بازی و پرسش‌های متداول`, `- [بلاگ](${absolute(site, '/blog')}): مقاله‌ها`, `- [بازیگران](${absolute(site, '/cast')}): شخصیت‌های بازی`];
  if (posts.length) lines.push('', '## مقاله‌ها', ...posts.map((p) => `- [${p.title}](${absolute(site, `/blog/${encodeURIComponent(p.slug)}`)})${p.summary ? `: ${p.summary.replace(/\s+/g, ' ')}` : ''}`));
  if (site.appUrl) lines.push('', '## بازی', `- [بازی کن](${site.appUrl})`);
  return `${lines.join('\n')}\n`;
}

/** `llms-full.txt`: the same, expanded to the plain text of every post, the cast and the FAQ. */
export function llmsFull(site: Site, data: LandingData, posts: { title: string; slug: string; bodyMd: string }[]): string {
  const parts = [`# ${site.name}`, '', data.site.heroText || site.tagline];
  if (data.faq.length) parts.push('', '## پرسش‌های متداول', ...data.faq.flatMap((f) => ['', `### ${f.question}`, f.answer]));
  if (data.cast.length) parts.push('', '## بازیگران', ...data.cast.flatMap((c) => ['', `### ${c.name}${c.role ? ` — ${c.role}` : ''}`, c.bio]));
  for (const p of posts) parts.push('', `## ${p.title}`, `(${absolute(site, `/blog/${encodeURIComponent(p.slug)}`)})`, '', plainText(p.bodyMd));
  return `${parts.join('\n')}\n`;
}
