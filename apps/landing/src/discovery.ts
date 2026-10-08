import type { LandingData, PostSummary } from './api.js';
import { plainText } from './markdown.js';
import { absolute } from './seo.js';
import type { Site } from './seo.js';

const xml = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string);
const iso = (ms: number): string => new Date(ms).toISOString();

/** `sitemap.xml`: every indexable page with its real last-modified time and `hreflang` alternates; noindex pages never appear. */
export function sitemap(site: Site, posts: PostSummary[]): string {
  if (site.indexable === false) posts = [];
  const latest = posts.reduce((m, p) => Math.max(m, p.updatedAt), 0);
  const urls: { path: string; lastmod?: number }[] = [{ path: '/', lastmod: latest || undefined }, { path: '/blog', lastmod: latest || undefined }, { path: '/about' }, { path: '/download' }, { path: '/contact' }, { path: '/cast' }, { path: '/terms' }, { path: '/privacy' }, { path: '/sitemap' }, ...posts.map((p) => ({ path: `/blog/${encodeURIComponent(p.slug)}`, lastmod: p.updatedAt }))];
  const entries = urls
    .map((u) => {
      const loc = xml(absolute(site, u.path));
      return `<url><loc>${loc}</loc>${u.lastmod ? `<lastmod>${iso(u.lastmod)}</lastmod>` : ''}<xhtml:link rel="alternate" hreflang="fa-IR" href="${loc}"/><xhtml:link rel="alternate" hreflang="x-default" href="${loc}"/></url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries}\n</urlset>\n`;
}

/** `sitemap.xsl`: makes `sitemap.xml` open as a branded page in a browser (crawlers still read plain XML). Same-origin fonts only. */
export function sitemapXsl(site: Site): string {
  const css = `@font-face{font-family:Vazirmatn;font-weight:400;src:url(/fonts/Vazirmatn-400.woff2)}@font-face{font-family:Vazirmatn;font-weight:800;src:url(/fonts/Vazirmatn-800.woff2)}@font-face{font-family:Lalezar;src:url(/fonts/Lalezar-Regular.woff2)}
*{box-sizing:border-box}body{margin:0;background:#FFF6E8;color:#2B1240;font:400 17px/1.9 Vazirmatn,Tahoma,sans-serif}
header{background:#FFC93C;border-bottom:4px solid #2B1240;padding:28px 24px}.w{max-width:900px;margin:0 auto}
h1{font:400 clamp(38px,6vw,60px)/1.2 Lalezar,Vazirmatn,sans-serif;margin:0}header p{margin:6px 0 0;font-weight:800}
.bar{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 0}.bar a,.pill{display:inline-block;font-weight:800;font-size:14px;line-height:1.8;padding:2px 14px;border:3px solid #2B1240;border-radius:999px;background:#FFF6E8;color:#2B1240;text-decoration:none}.bar a:hover{background:#FF4D8D;color:#FFF6E8}
main{padding:28px 24px 56px}.info{background:#fff;border:3px dashed #2B1240;border-radius:18px;padding:10px 18px;font-size:15px;margin:0 0 24px}
ul{list-style:none;margin:0;padding:0;display:grid;gap:14px}
li a.row{display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#fff;border:4px solid #2B1240;border-radius:24px;box-shadow:0 5px 0 #2B1240;padding:12px 20px;color:#2B1240;text-decoration:none}
li a.row:hover{transform:translateY(2px);box-shadow:0 3px 0 #2B1240}.n{width:40px;height:40px;border-radius:50%;border:3px solid #2B1240;display:grid;place-items:center;font:400 20px/1 Lalezar,sans-serif;background:#FFC93C}
.u{flex:1;min-width:200px;direction:ltr;text-align:left;font:700 15px/1.6 ui-monospace,monospace;overflow-wrap:anywhere}.d{font-size:13px;font-weight:800;direction:ltr}
footer{border-top:4px solid #2B1240;background:#2B1240;color:#FFF6E8;padding:20px 24px;text-align:center;font-size:14px}footer a{color:#FFC93C}`;
  const kinds: [string, string, string][] = [['/blog/', 'مقاله', '#A66BF0'], ['/blog', 'وبلاگ', '#A66BF0'], ['/download', 'دانلود', '#7ED957'], ['/about', 'درباره', '#3FC1F0'], ['/contact', 'تماس', '#3FC1F0'], ['/cast', 'بازیگران', '#FF7A3D'], ['/terms', 'قوانین', '#7ED957'], ['/privacy', 'قوانین', '#7ED957'], ['/sitemap', 'نقشه', '#FFC93C']];
  const test = (k: string): string => (k.endsWith('/') ? `contains($p,'${k}')` : `$p='${k}'`);
  const pick = (idx: 1 | 2): string => `<xsl:choose><xsl:when test="$p='/'">${idx === 1 ? 'خانه' : '#FF4D8D'}</xsl:when>${kinds.map((k) => `<xsl:when test="${test(k[0])}">${k[idx]}</xsl:when>`).join('')}<xsl:otherwise>${idx === 1 ? 'صفحه' : '#FFC93C'}</xsl:otherwise></xsl:choose>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" exclude-result-prefixes="s xhtml">
<xsl:output method="html" encoding="UTF-8" doctype-system="about:legacy-compat" indent="no"/>
<xsl:template match="/">
<html lang="fa" dir="rtl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex"/><title>نقشه‌ی سایت ${xml(site.name)} (XML)</title><style>${css}</style></head>
<body>
<header><div class="w"><h1>نقشه‌ی سایت ${xml(site.name)}</h1><p>${xml(site.tagline)}</p>
<div class="bar"><a href="/">صفحه‌ی اول</a><a href="/sitemap">نقشه‌ی سایت برای آدم‌ها</a><a href="/blog">وبلاگ</a><a href="/robots.txt">robots.txt</a><a href="/llms.txt">llms.txt</a><a href="/llms-full.txt">llms-full.txt</a></div></div></header>
<main><div class="w">
<p class="info">این فایل برای موتورهای جست‌وجو ساخته شده و <b><xsl:value-of select="count(s:urlset/s:url)"/></b> نشانی دارد؛ همه‌ی آن‌ها را این‌جا می‌بینی.</p>
<ul><xsl:for-each select="s:urlset/s:url"><xsl:variable name="p" select="concat('/',substring-after(substring-after(s:loc,'//'),'/'))"/>
<li><a class="row" href="{s:loc}"><span class="n"><xsl:value-of select="position()"/></span><span class="pill"><xsl:attribute name="style">background:<xsl:choose><xsl:when test="$p='/'">#FF4D8D</xsl:when>${kinds.map((k) => `<xsl:when test="${test(k[0])}">${k[2]}</xsl:when>`).join('')}<xsl:otherwise>#FFC93C</xsl:otherwise></xsl:choose></xsl:attribute>${pick(1)}</span><span class="u"><xsl:value-of select="s:loc"/></span><xsl:if test="s:lastmod"><span class="d"><xsl:value-of select="substring-before(s:lastmod,'T')"/></span></xsl:if></a></li>
</xsl:for-each></ul></div></main>
<footer>${xml(site.name)} · <a href="/">${xml(site.url.replace(/^https?:\/\//, ''))}</a></footer>
</body></html>
</xsl:template>
</xsl:stylesheet>
`;
}

/** A plain brand card (1200x630) served at `/og.svg` until the owner sets a real `landing.og_image` in the admin panel. */
export function ogCard(site: Site): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#2B1240"/><rect x="40" y="40" width="1120" height="550" rx="48" fill="#40166A" stroke="#FFC93C" stroke-width="8"/><text x="600" y="300" text-anchor="middle" font-family="Vazirmatn,Tahoma,sans-serif" font-size="140" font-weight="800" fill="#FFC93C">${xml(site.name)}</text><text x="600" y="410" text-anchor="middle" font-family="Vazirmatn,Tahoma,sans-serif" font-size="52" fill="#FFF6E8">${xml(site.tagline)}</text></svg>`;
}

/** AI crawlers named explicitly so the permission is visible; nothing on this site is private. */
export const AI_AGENTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended'] as const;

export function robots(site: Site): string {
  if (site.indexable === false) return 'User-agent: *\nDisallow: /\n';
  const groups = ['*', ...AI_AGENTS].map((a) => `User-agent: ${a}\nAllow: /`).join('\n\n');
  return `${groups}\n\nSitemap: ${absolute(site, '/sitemap.xml')}\n`;
}

/** `llms.txt`: a compact, link-rich map of the site for answer engines (https://llmstxt.org). */
export function llmsTxt(site: Site, data: LandingData, posts: PostSummary[]): string {
  const lines = [`# ${site.name}`, '', `> ${data.site.heroText || site.tagline}`, '', '## صفحه‌های اصلی', `- [صفحه‌ی اول](${absolute(site, '/')}): معرفی بازی و پرسش‌های متداول`, `- [درباره‌ی ما](${absolute(site, '/about')}): قصه‌ی اسم و ایده‌ی بازی`, `- [دانلود](${absolute(site, '/download')}): نصب رایگان`, `- [تماس و پرسش‌ها](${absolute(site, '/contact')}): پرسش‌های متداول و راه تماس`, `- [بلاگ](${absolute(site, '/blog')}): مقاله‌ها`, `- [بازیگران](${absolute(site, '/cast')}): شخصیت‌های بازی`, `- [نقشه‌ی سایت](${absolute(site, '/sitemap')}): فهرست همه‌ی صفحه‌ها`];
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
