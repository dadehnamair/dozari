import type { CommentTarget, PublicComment } from './api.js';
import { escapeHtml } from './markdown.js';

/** Human-readable Persian date of an epoch-ms instant (Solar Hijri, Tehran). */
export const faDate = (ms: number): string => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tehran' }).format(ms);
export const faNum = (n: number | string): string => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)] as string);
export const faInt = (n: number): string => faNum(new Intl.NumberFormat('en-US').format(n).replace(/,/g, '٬'));

/** What the visitor sees after sending a comment form (`?c=` of the redirect back to the page). */
export type Flash = 'ok' | 'invalid_name' | 'invalid_body' | 'links_not_allowed' | 'blocked_word' | 'rate_limited' | 'unavailable' | 'failed' | null;
const FLASH_TEXT: Record<string, [boolean, string]> = {
  ok: [true, 'ممنون! نظرت ثبت شد و بعد از بررسی همین‌جا دیده می‌شود.'],
  invalid_name: [false, 'اسم باید بین ۲ تا ۶۰ نویسه باشد.'],
  invalid_body: [false, 'متن نظر باید بین ۳ تا ۱۰۰۰ نویسه باشد.'],
  links_not_allowed: [false, 'لینک و آدرس سایت در نظرها جا ندارد.'],
  blocked_word: [false, 'متن نظر کلمه‌ی نامناسب دارد؛ لطفاً بازنویسی کن.'],
  rate_limited: [false, 'کمی زیاد نظر فرستادی؛ چند دقیقه‌ی دیگر دوباره امتحان کن.'],
  unavailable: [false, 'الان نمی‌توانیم نظر را ثبت کنیم؛ کمی بعد دوباره بفرست.'],
  failed: [false, 'نظر ثبت نشد؛ دوباره امتحان کن.'],
};
export const flashOf = (v: unknown): Flash => (typeof v === 'string' && v in FLASH_TEXT ? (v as Flash) : null);

/**
 * The comments block of a post or cast page: approved comments (plain escaped text), then a plain HTML form that posts to `/comments`
 * (works without scripts; a hidden `website` field is the honeypot). New comments wait for an admin before they show.
 */
export function commentsSection(type: CommentTarget, key: string, comments: PublicComment[], flash: Flash, heading = 'نظر شما'): string {
  const f = flash ? FLASH_TEXT[flash] : null;
  const list = comments.length
    ? `<ol class="cmts">${comments.map((c) => `<li id="c-${escapeHtml(c.id)}"><div class="cm-h"><b>${escapeHtml(c.author)}</b><time datetime="${new Date(c.createdAt).toISOString()}">${escapeHtml(faDate(c.createdAt))}</time></div><p>${escapeHtml(c.body)}</p></li>`).join('')}</ol>`
    : '<p class="cm-none">هنوز نظری ثبت نشده؛ اولینش را تو بنویس.</p>';
  return `<section class="cm" id="comments" aria-labelledby="cm-t"><h2 id="cm-t">${escapeHtml(heading)} <span class="cm-n">(${faNum(comments.length)})</span></h2>
${f ? `<p class="cm-flash ${f[0] ? 'ok' : 'err'}" role="status">${escapeHtml(f[1])}</p>` : ''}
${list}
<form class="cm-form" method="post" action="/comments">
<input type="hidden" name="type" value="${type}"><input type="hidden" name="key" value="${escapeHtml(key)}">
<div class="cm-hp" aria-hidden="true"><label>وب‌سایت<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
<label>اسمت<input type="text" name="name" required minlength="2" maxlength="60" autocomplete="nickname"></label>
<label>نظرت<textarea name="body" required minlength="3" maxlength="1000" rows="4"></textarea></label>
<button class="btn" type="submit">ثبت نظر</button>
<small>نظرها بعد از بررسی منتشر می‌شوند؛ لینک و کلمه‌ی نامناسب پذیرفته نمی‌شود.</small>
</form></section>`;
}

/** Styles of the pages added after the first release (sitemap, status, stats, guides, press, comments). */
export const EXTRA_CSS = `
.cm{margin-top:48px;padding:28px;background:#fff;border:4px solid var(--ink);border-radius:28px;box-shadow:0 6px 0 var(--ink)}main.page .cm h2{font-size:34px;margin:0 0 12px}.cm-n{opacity:.6;font-size:.7em}
.cmts{list-style:none;margin:0 0 24px;padding:0;display:grid;gap:12px}.cmts li{background:var(--cream);border:3px solid var(--ink);border-radius:18px;padding:12px 16px}.cmts p{margin:.3em 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
.cm-h{display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap;font-size:14px}.cm-h time{opacity:.65}.cm-none{opacity:.7}
.cm-form{display:grid;gap:12px}.cm-form label{display:grid;gap:4px;font-weight:700;font-size:15px}.cm-form input,.cm-form textarea{font:inherit;padding:10px 14px;border:3px solid var(--ink);border-radius:14px;background:#fff;color:var(--ink)}
.cm-form .btn{justify-self:start;cursor:pointer}.cm-form small{opacity:.7}.cm-hp{position:absolute;inset-inline-start:-9999px;height:0;overflow:hidden}
.cm-flash{border:3px solid var(--ink);border-radius:14px;padding:10px 14px;font-weight:700;margin:0 0 16px}.cm-flash.ok{background:var(--lime)}.cm-flash.err{background:var(--pink);color:var(--cream)}
.smap{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin-top:20px}.smap section{background:#fff;border:4px solid var(--ink);border-radius:28px;padding:20px 22px;box-shadow:0 6px 0 var(--ink)}
main.page .smap h2{font-size:30px;margin:0 0 8px}.smap ul{list-style:none;margin:0;padding:0;display:grid;gap:4px}.smap li a{font-weight:700;text-decoration:none}.smap li small{display:block;opacity:.7;font-weight:500;font-size:13px;line-height:1.6}
.stg{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;list-style:none;margin:20px 0;padding:0}.stg li{background:#fff;border:4px solid var(--ink);border-radius:24px;padding:18px 20px;box-shadow:0 5px 0 var(--ink);display:grid;gap:2px}
.stg b{font-family:var(--display);font-weight:400;font-size:46px;line-height:1.1}.stg span{font-weight:700}.stg small{opacity:.7}
.svc{list-style:none;margin:20px 0;padding:0;display:grid;gap:12px}.svc li{display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:#fff;border:4px solid var(--ink);border-radius:20px;padding:14px 20px}
.sdot{display:inline-block;width:14px;height:14px;border-radius:50%;border:3px solid var(--ink);margin-inline-end:8px;vertical-align:middle}.sdot.ok{background:var(--lime)}.sdot.warn{background:var(--yellow)}.sdot.down{background:var(--pink)}
.sbanner{border:4px solid var(--ink);border-radius:28px;padding:24px;box-shadow:0 6px 0 var(--ink);display:flex;gap:16px;align-items:center;margin:20px 0}.sbanner .sdot{width:26px;height:26px;background:var(--cream);margin:0;flex:none}.sbanner h1{font-size:clamp(30px,4vw,46px);margin:0}.sbanner.ok{background:var(--lime)}.sbanner.warn{background:var(--yellow)}.sbanner.down{background:var(--pink);color:var(--cream)}
.guide{counter-reset:g;display:grid;gap:16px;list-style:none;padding:0;margin:20px 0}.guide li{counter-increment:g;background:#fff;border:4px solid var(--ink);border-radius:24px;padding:18px 22px 18px 22px;box-shadow:0 5px 0 var(--ink)}.guide li::before{content:counter(g,persian);font-family:var(--display);font-size:34px;color:var(--pink);margin-inline-end:10px}.guide h3{display:inline;font-size:26px}.guide p{margin:.3em 0 0}
.gl{display:grid;gap:12px;margin:20px 0}.gl dt{font-family:var(--display);font-size:26px}.gl dd{margin:0 0 10px;font-weight:500}.gl div{background:#fff;border:3px solid var(--ink);border-radius:18px;padding:12px 18px}
.kit{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;margin:20px 0}.kit figure{margin:0;background:#fff;border:4px solid var(--ink);border-radius:24px;overflow:hidden;box-shadow:0 5px 0 var(--ink)}.kit img{width:100%;height:auto;background:var(--yellow)}.kit figcaption{padding:10px 14px;font-weight:700;font-size:14px}
.sw{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.sw span{display:grid;place-items:center;min-width:104px;padding:14px 10px;border:3px solid var(--ink);border-radius:16px;font:700 13px ui-monospace,monospace;direction:ltr}
.tags{display:flex;gap:8px;flex-wrap:wrap;list-style:none;padding:0;margin:12px 0}.tags li{border:3px solid var(--ink);border-radius:999px;padding:2px 14px;font-weight:700;background:var(--cream)}
.cc .more{display:inline-block;margin-top:8px;font-weight:800}
`;
