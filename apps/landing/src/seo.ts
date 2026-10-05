import { escapeHtml } from './markdown.js';

/**
 * The one place SEO and GEO markup is built (head tags, JSON-LD graph, breadcrumbs), so no page writes its own:
 * hand-written heads drift apart. Pure functions; nothing here reads a clock or the network.
 */

export interface Site {
  name: string;
  tagline: string;
  /** Origin of this landing site, no trailing slash. */
  url: string;
  /** Organisation facts that are real; empty values are simply left out of the markup. */
  contactEmail: string | null;
  sameAs: string[];
  appUrl: string | null;
  androidApp: string | null;
  badges?: { id: string; url: string | null }[];
  /** Admin-set extras (group «سئو و سایت معرفی»); all optional. */
  ogImage?: string | null;
  ogImageAlt?: string | null;
  keywords?: string[];
  fontUrl?: string | null;
  /** False = every page is noindex and robots.txt closes the site (pre-launch). */
  indexable?: boolean;
  verify?: { google: string | null; bing: string | null; yandex: string | null; enamad?: string | null };
  /** Self-hosted analytics script (never a third-party service). */
  analytics?: { scriptUrl: string; siteId: string } | null;
}

export interface Crumb {
  name: string;
  /** Path starting with `/`; the last crumb has none (it is the current page). */
  path?: string;
}

export interface HeadInput {
  title: string;
  description: string;
  /** Path of the page itself, no query. */
  path: string;
  type?: 'website' | 'article';
  image?: string | null;
  noindex?: boolean;
  /** Page-specific JSON-LD nodes added to the shared graph. */
  nodes?: Record<string, unknown>[];
  crumbs?: Crumb[];
  publishedTime?: number | null;
  modifiedTime?: number | null;
}

/** A meta description: whitespace squashed, cut at 160 characters on a word boundary. */
export function description(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).trim()}…`;
}

export const absolute = (site: Site, path: string): string => `${site.url}${path}`;

/** `@id`s of the shared nodes every page refers to. */
export const ids = (site: Site) => ({ org: `${site.url}/#organization`, site: `${site.url}/#website` });

/** The Organization and WebSite nodes (only real facts) that every page carries once. */
export function siteNodes(site: Site): Record<string, unknown>[] {
  const i = ids(site);
  const org: Record<string, unknown> = { '@type': 'Organization', '@id': i.org, name: site.name, url: `${site.url}/` };
  if (site.ogImage) org.logo = site.ogImage;
  if (site.sameAs.length > 0) org.sameAs = site.sameAs;
  if (site.contactEmail) org.email = site.contactEmail;
  return [org, { '@type': 'WebSite', '@id': i.site, url: `${site.url}/`, name: site.name, inLanguage: 'fa-IR', publisher: { '@id': i.org }, ...(site.keywords && site.keywords.length > 0 ? { keywords: site.keywords.join(', ') } : {}) }];
}

export function breadcrumbList(site: Site, crumbs: Crumb[]): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, n) => ({ '@type': 'ListItem', position: n + 1, name: c.name, ...(c.path !== undefined ? { item: absolute(site, c.path) } : {}) })),
  };
}

/** One `<script type="application/ld+json">` graph; `<` is escaped so a value can never close the tag. */
export function graphScript(nodes: Record<string, unknown>[]): string {
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

export function faqNode(pairs: { question: string; answer: string }[]): Record<string, unknown> | null {
  if (pairs.length === 0) return null;
  return { '@type': 'FAQPage', mainEntity: pairs.map((p) => ({ '@type': 'Question', name: p.question, acceptedAnswer: { '@type': 'Answer', text: p.answer } })) };
}

/** Everything inside `<head>` for a page. */
export function head(site: Site, h: HeadInput): string {
  const url = absolute(site, h.path);
  const image = h.image ?? site.ogImage ?? `${site.url}/banners/og.jpg`;
  const tags = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(h.title)}</title>`,
    `<meta name="description" content="${escapeHtml(h.description)}">`,
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    `<meta name="robots" content="${h.noindex || site.indexable === false ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">`,
    `<link rel="alternate" hreflang="fa-IR" href="${escapeHtml(url)}">`,
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(url)}">`,
    `<meta property="og:type" content="${h.type ?? 'website'}">`,
    `<meta property="og:site_name" content="${escapeHtml(site.name)}">`,
    `<meta property="og:locale" content="fa_IR">`,
    `<meta property="og:title" content="${escapeHtml(h.title)}">`,
    `<meta property="og:description" content="${escapeHtml(h.description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    ...(site.ogImageAlt ? [`<meta property="og:image:alt" content="${escapeHtml(site.ogImageAlt)}">`, `<meta name="twitter:image:alt" content="${escapeHtml(site.ogImageAlt)}">`] : []),
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(h.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(h.description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
    '<meta name="theme-color" content="#2B1240">',
    '<link rel="icon" href="/favicon.ico" sizes="48x48">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">',
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
  ];
  if (site.verify?.google) tags.push(`<meta name="google-site-verification" content="${escapeHtml(site.verify.google)}">`);
  if (site.verify?.bing) tags.push(`<meta name="msvalidate.01" content="${escapeHtml(site.verify.bing)}">`);
  if (site.verify?.enamad) tags.push(`<meta name="enamad" content="${escapeHtml(site.verify.enamad)}">`);
  if (site.verify?.yandex) tags.push(`<meta name="yandex-verification" content="${escapeHtml(site.verify.yandex)}">`);
  if (site.analytics) tags.push(`<script defer src="${escapeHtml(site.analytics.scriptUrl)}" data-website-id="${escapeHtml(site.analytics.siteId)}"></script>`);
  if (site.fontUrl) tags.push(`<link rel="preload" href="${escapeHtml(site.fontUrl)}" as="font" type="font/woff2" crossorigin>`, `<style>@font-face{font-family:"DozariWeb";src:url("${escapeHtml(site.fontUrl)}") format("woff2");font-display:swap}body{font-family:DozariWeb,Vazirmatn,Tahoma,system-ui,sans-serif}</style>`);
  if (h.publishedTime) tags.push(`<meta property="article:published_time" content="${new Date(h.publishedTime).toISOString()}">`);
  if (h.modifiedTime) tags.push(`<meta property="article:modified_time" content="${new Date(h.modifiedTime).toISOString()}">`);
  const nodes = [...siteNodes(site), ...(h.crumbs && h.crumbs.length > 1 ? [breadcrumbList(site, h.crumbs)] : []), ...(h.nodes ?? [])];
  tags.push(graphScript(nodes));
  return tags.join('\n');
}
