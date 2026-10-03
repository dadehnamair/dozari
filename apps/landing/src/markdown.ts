/**
 * A small, safe Markdown renderer for blog posts: every character of the input is HTML-escaped first, so raw HTML can never get through,
 * and only `http(s)`, root-relative and `mailto:` links survive. Supports `##`/`###` headings (with unique `id` anchors, for citing a
 * section), paragraphs, `-`/`1.` lists, `>` quotes, **bold**, *italic*, `code`, links and `---`. Pure.
 */

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c] as string);

/** An anchor id from a heading: letters and digits kept, spaces → `-`. */
export function headingId(text: string): string {
  return (
    text
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\s_‌]+/g, '-')
      .replace(/[^\p{L}\p{N}-]+/gu, '')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  );
}

const safeHref = (href: string): string | null => (/^(https?:\/\/|\/(?!\/)|mailto:)/i.test(href) ? href : null);

/** Inline marks on text that is ALREADY escaped. */
function inline(escaped: string): string {
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
      // `href` was escaped with the rest; undo only what is needed to judge the address, then re-escape it.
      const raw = href.replace(/&amp;/g, '&');
      const ok = safeHref(raw);
      return ok ? `<a href="${escapeHtml(ok)}"${/^https?:/i.test(ok) ? ' rel="noopener"' : ''}>${label}</a>` : label;
    });
}

export interface Heading {
  level: 2 | 3;
  text: string;
  id: string;
}

/** The HTML of a post and its headings (for a table of contents). */
export function renderMarkdown(source: string): { html: string; headings: Heading[] } {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  const headings: Heading[] = [];
  const used = new Map<string, number>();
  let para: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;
  let quote: string[] = [];

  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(escapeHtml(para.join(' ')))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(escapeHtml(i))}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) out.push(`<blockquote><p>${inline(escapeHtml(quote.join(' ')))}</p></blockquote>`);
    quote = [];
  };
  const flushAll = () => (flushPara(), flushList(), flushQuote());

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{2,3})\s+(.+)$/.exec(line);
    const ul = /^[-*]\s+(.+)$/.exec(line);
    const ol = /^\d+[.)]\s+(.+)$/.exec(line);
    const bq = /^>\s?(.*)$/.exec(line);
    if (line.trim() === '') flushAll();
    else if (h) {
      flushAll();
      const level = (h[1] as string).length as 2 | 3;
      const text = (h[2] as string).trim();
      const base = headingId(text);
      const n = used.get(base) ?? 0;
      used.set(base, n + 1);
      const id = n === 0 ? base : `${base}-${n + 1}`;
      headings.push({ level, text, id });
      out.push(`<h${level} id="${escapeHtml(id)}">${inline(escapeHtml(text))}</h${level}>`);
    } else if (/^-{3,}$/.test(line.trim())) {
      flushAll();
      out.push('<hr>');
    } else if (ul || ol) {
      flushPara();
      flushQuote();
      const tag = ul ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push((ul ?? ol)![1] as string);
    } else if (bq) {
      flushPara();
      flushList();
      quote.push(bq[1] as string);
    } else {
      flushList();
      flushQuote();
      para.push(line.trim());
    }
  }
  flushAll();
  return { html: out.join('\n'), headings };
}

/** Plain text of a Markdown post (marks removed): for descriptions and llms-full.txt. */
export function plainText(source: string): string {
  return source
    .replace(/\r\n?/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*`>_]/g, '')
    .replace(/^[-\d.)\s]+(?=\S)/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
