import type { CastMember, FaqPair, LandingData, Post, PostList, PostSummary } from './api.js';
import { escapeHtml, plainText, renderMarkdown } from './markdown.js';
import { absolute, description, faqNode, head, ids } from './seo.js';
import type { Crumb, Site } from './seo.js';

/** Human-readable Persian date of an epoch-ms instant (Solar Hijri, Tehran). */
export const faDate = (ms: number): string => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tehran' }).format(ms);

const CSS = `
:root{--ink:#2B1240;--cream:#FFF6E8;--yellow:#FFC93C;--orange:#FF7A3D;--lime:#7ED957;--pink:#FF8FB6}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:Vazirmatn,Tahoma,"Segoe UI",system-ui,sans-serif;background:var(--cream);color:var(--ink);line-height:1.9;font-size:17px}
a{color:#7E46D6}a:hover{color:var(--orange)}
header.top{background:var(--ink);color:#fff}
.bar{max-width:980px;margin:0 auto;padding:12px 18px;display:flex;align-items:center;gap:18px;flex-wrap:wrap}
.brand{font-weight:800;font-size:24px;color:var(--yellow);text-decoration:none}
nav.main{display:flex;gap:14px;flex:1;flex-wrap:wrap}nav.main a{color:#fff;text-decoration:none;padding:2px 4px}
.btn{display:inline-block;background:var(--lime);color:var(--ink);font-weight:800;text-decoration:none;border:3px solid var(--ink);border-radius:14px;padding:6px 18px}
.btn.alt{background:var(--yellow)}
main{max-width:820px;margin:0 auto;padding:22px 18px 40px}
h1{font-size:34px;line-height:1.4;margin:.2em 0 .4em}h2{font-size:24px;margin:1.6em 0 .4em;line-height:1.5}h3{font-size:19px}
.hero{background:linear-gradient(160deg,#FFE48A,var(--yellow) 55%,var(--orange));border:4px solid var(--ink);border-radius:26px;padding:26px 22px;margin-bottom:10px}
.hero p{font-size:19px}.cta{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
.crumbs{font-size:14px;margin:6px 0 0;padding:0;list-style:none;display:flex;gap:6px;flex-wrap:wrap}.crumbs li+li::before{content:"‹";margin-inline-end:6px;opacity:.6}
.cards{display:grid;gap:14px;padding:0;list-style:none}
.card{background:#fff;border:3px solid var(--ink);border-radius:18px;padding:14px 16px}.card h2,.card h3{margin:.1em 0}
.meta{font-size:14px;opacity:.75}
article img.cover{max-width:100%;height:auto;border-radius:16px;border:3px solid var(--ink)}
article blockquote{margin:1em 0;padding:.2em 1em;border-inline-start:5px solid var(--yellow);background:#fff}
article code{background:#fff;border:1px solid #ddd;border-radius:6px;padding:0 5px;font-family:ui-monospace,monospace}
.toc{background:#fff;border:2px dashed var(--ink);border-radius:14px;padding:8px 16px;margin:14px 0}
footer.bottom{background:var(--ink);color:#e8dff5;padding:22px 18px;margin-top:30px}
footer.bottom .bar{padding:0;align-items:flex-start}footer.bottom a{color:#FFE48A}
.pager{display:flex;gap:12px;justify-content:center;margin-top:18px}
.steps li{margin:.4em 0}
`;

const li = (items: string[]): string => items.map((i) => `<li>${i}</li>`).join('');

function layout(site: Site, headHtml: string, crumbs: Crumb[] | null, body: string): string {
  const crumbHtml =
    crumbs && crumbs.length > 1
      ? `<nav aria-label="مسیر صفحه"><ol class="crumbs">${li(crumbs.map((c) => (c.path !== undefined ? `<a href="${escapeHtml(c.path)}">${escapeHtml(c.name)}</a>` : `<span aria-current="page">${escapeHtml(c.name)}</span>`)))}</ol></nav>`
      : '';
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
${headHtml}
<style>${CSS}</style>
</head>
<body>
<header class="top"><div class="bar">
<a class="brand" href="/">${escapeHtml(site.name)}</a>
<nav class="main" aria-label="منوی اصلی"><a href="/">صفحه‌ی اول</a><a href="/blog">بلاگ دوزاری</a><a href="/cast">بازیگران دوزاری</a></nav>
${site.appUrl ? `<a class="btn" href="${escapeHtml(site.appUrl)}">بازی کن</a>` : ''}
</div></header>
<main>
${crumbHtml}
${body}
</main>
<footer class="bottom"><div class="bar"><div>
<p><strong>${escapeHtml(site.name)}</strong> — ${escapeHtml(site.tagline)}</p>
<p><a href="/">صفحه‌ی اول</a> · <a href="/blog">مقاله‌های بلاگ</a> · <a href="/cast">آشنایی با شخصیت‌های بازی</a> · <a href="/privacy">حریم خصوصی</a>${site.androidApp ? ` · <a href="${escapeHtml(site.androidApp)}">دانلود برنامه‌ی اندروید</a>` : ''}${site.contactEmail ? ` · <a href="mailto:${escapeHtml(site.contactEmail)}">تماس با ما</a>` : ''}</p>
</div></div></footer>
</body>
</html>`;
}

const postCard = (p: PostSummary): string =>
  `<li class="card"><h3><a href="/blog/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a></h3><p class="meta">${escapeHtml(faDate(p.publishedAt))}${p.author ? ` · ${escapeHtml(p.author)}` : ''}</p>${p.summary ? `<p>${escapeHtml(p.summary)}</p>` : ''}</li>`;

const HOW_TO = [
  ['کالاها را ببین', 'شانزده کالا روی صفحه است؛ هر کدام یک قیمت واقعی در یکی از سال‌های گذشته ایران دارد.'],
  ['چهارتا چهارتا گروه کن', 'کالاهایی را که یک قاعده‌ی مشترک دارند کنار هم بگذار؛ مثلاً قیمتشان در یک سال یا یک بازه است.'],
  ['حدس بزن و ادامه بده', 'هر گروه درست یک دسته‌ی رنگی می‌شود؛ اشتباه‌ها محدودند.'],
  ['با دوستانت رقابت کن', 'همین بازی را تکی یا زنده دونفره، دو در دو و در تورنومنت بازی کن.'],
] as const;

export function homePage(site: Site, data: LandingData, latest: PostSummary[]): string {
  const { site: s, cast, faq } = data;
  const i = ids(site);
  const title = s.seo?.title || `${s.name} — ${s.tagline}`;
  const desc = description(s.seo?.description || s.heroText || s.tagline);
  const nodes: Record<string, unknown>[] = [
    { '@type': 'WebPage', '@id': `${site.url}/#webpage`, url: `${site.url}/`, name: title, description: desc, inLanguage: 'fa-IR', isPartOf: { '@id': i.site }, about: { '@id': i.org } },
    {
      '@type': 'HowTo',
      name: `${s.name} چطور بازی می‌شود؟`,
      step: HOW_TO.map(([name, text], n) => ({ '@type': 'HowToStep', position: n + 1, name, text })),
    },
  ];
  const faqN = faqNode(faq);
  if (faqN) nodes.push(faqN);
  const body = `
<section class="hero"><h1>${escapeHtml(s.heroTitle || s.name)}</h1>
<p>${escapeHtml(s.heroText)}</p>
<div class="cta">${site.appUrl ? `<a class="btn" href="${escapeHtml(site.appUrl)}">همین حالا بازی کن</a>` : ''}${site.androidApp ? `<a class="btn alt" href="${escapeHtml(site.androidApp)}">دانلود برنامه‌ی اندروید</a>` : ''}</div></section>
<h2>${escapeHtml(s.name)} چطور بازی می‌شود؟</h2>
<ol class="steps">${li(HOW_TO.map(([n, t]) => `<strong>${escapeHtml(n)}:</strong> ${escapeHtml(t)}`))}</ol>
${latest.length ? `<h2>تازه‌ترین مقاله‌های بلاگ</h2><ul class="cards">${latest.map(postCard).join('')}</ul><p><a href="/blog">همه‌ی مقاله‌های بلاگ دوزاری</a></p>` : ''}
${cast.length ? `<h2>با شخصیت‌های ${escapeHtml(s.name)} آشنا شو</h2><ul class="cards">${cast.slice(0, 4).map((c) => `<li class="card"><h3>${escapeHtml(c.name)}</h3><p class="meta">${escapeHtml(c.role)}</p></li>`).join('')}</ul><p><a href="/cast">معرفی کامل بازیگران دوزاری</a></p>` : ''}
${faq.length ? `<h2>پرسش‌های متداول</h2>${faq.map((f) => `<h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p>`).join('')}` : ''}`;
  return layout(site, head(site, { title, description: desc, path: '/', nodes }), null, body);
}

export function blogIndexPage(site: Site, list: PostList): string {
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const path = list.page > 1 ? `/blog?page=${list.page}` : '/blog';
  const title = list.page > 1 ? `بلاگ ${site.name} — صفحه‌ی ${list.page}` : `بلاگ ${site.name}: مقاله‌هایی درباره‌ی قیمت‌های قدیمی`;
  const desc = description(`مقاله‌های بلاگ ${site.name} درباره‌ی قیمت کالاها در سال‌های گذشته ایران، نوستالژی و ترفندهای بازی.`);
  const crumbs: Crumb[] = [{ name: 'صفحه‌ی اول', path: '/' }, { name: 'بلاگ' }];
  const nodes: Record<string, unknown>[] = [
    { '@type': 'CollectionPage', '@id': `${absolute(site, path)}#webpage`, url: absolute(site, path), name: title, description: desc, inLanguage: 'fa-IR', isPartOf: { '@id': ids(site).site } },
    { '@type': 'ItemList', itemListElement: list.posts.map((p, n) => ({ '@type': 'ListItem', position: n + 1, url: absolute(site, `/blog/${encodeURIComponent(p.slug)}`), name: p.title })) },
  ];
  const pager = pages > 1 ? `<nav class="pager" aria-label="صفحه‌بندی">${list.page > 1 ? `<a href="${list.page === 2 ? '/blog' : `/blog?page=${list.page - 1}`}">صفحه‌ی قبل</a>` : ''}<span>صفحه‌ی ${list.page} از ${pages}</span>${list.page < pages ? `<a href="/blog?page=${list.page + 1}">صفحه‌ی بعد</a>` : ''}</nav>` : '';
  const body = `<h1>بلاگ ${escapeHtml(site.name)}</h1><p>${escapeHtml(desc)}</p>${list.posts.length ? `<ul class="cards">${list.posts.map(postCard).join('')}</ul>` : '<p>هنوز مقاله‌ای منتشر نشده؛ به‌زودی برمی‌گردیم.</p>'}${pager}`;
  return layout(site, head(site, { title, description: desc, path, nodes, crumbs }), crumbs, body);
}

export function postPage(site: Site, post: Post, more: PostSummary[]): string {
  const path = `/blog/${encodeURIComponent(post.slug)}`;
  const { html, headings } = renderMarkdown(post.bodyMd);
  const title = post.metaTitle || `${post.title} | ${site.name}`;
  const desc = description(post.metaDescription || post.summary || plainText(post.bodyMd));
  const crumbs: Crumb[] = [{ name: 'صفحه‌ی اول', path: '/' }, { name: 'بلاگ', path: '/blog' }, { name: post.title }];
  const i = ids(site);
  const node: Record<string, unknown> = {
    '@type': 'BlogPosting',
    '@id': `${absolute(site, path)}#article`,
    mainEntityOfPage: absolute(site, path),
    headline: post.title.slice(0, 110),
    description: desc,
    inLanguage: 'fa-IR',
    datePublished: new Date(post.publishedAt).toISOString(),
    dateModified: new Date(post.updatedAt).toISOString(),
    author: post.author ? { '@type': 'Person', name: post.author } : { '@id': i.org },
    publisher: { '@id': i.org },
    isPartOf: { '@id': i.site },
  };
  if (post.coverUrl) node.image = post.coverUrl;
  const toc = headings.filter((h) => h.level === 2);
  const body = `<article>
<h1>${escapeHtml(post.title)}</h1>
<p class="meta">منتشر شده: <time datetime="${new Date(post.publishedAt).toISOString()}">${escapeHtml(faDate(post.publishedAt))}</time>${post.updatedAt - post.publishedAt > 86_400_000 ? ` · به‌روزرسانی: <time datetime="${new Date(post.updatedAt).toISOString()}">${escapeHtml(faDate(post.updatedAt))}</time>` : ''}${post.author ? ` · ${escapeHtml(post.author)}` : ''}</p>
${post.coverUrl ? `<p><img class="cover" src="${escapeHtml(post.coverUrl)}" alt="${escapeHtml(post.title)}" width="800" height="450"></p>` : ''}
${toc.length > 2 ? `<nav class="toc" aria-label="فهرست مطالب"><strong>در این مقاله</strong><ul>${li(toc.map((h) => `<a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a>`))}</ul></nav>` : ''}
${html}
</article>
${more.length ? `<h2>مقاله‌های بیشتر</h2><ul class="cards">${more.map(postCard).join('')}</ul>` : ''}`;
  return layout(site, head(site, { title, description: desc, path, type: 'article', image: post.coverUrl, nodes: [node], crumbs, publishedTime: post.publishedAt, modifiedTime: post.updatedAt }), crumbs, body);
}

export function castPage(site: Site, cast: CastMember[]): string {
  const title = `بازیگران ${site.name}: شخصیت‌های بازی`;
  const desc = description(`با شخصیت‌ها و آدم‌های ${site.name} آشنا شو: کی راهنمای بازی است و هر کس چه نقشی دارد.`);
  const crumbs: Crumb[] = [{ name: 'صفحه‌ی اول', path: '/' }, { name: 'بازیگران' }];
  const nodes: Record<string, unknown>[] = [{ '@type': 'AboutPage', '@id': `${site.url}/cast#webpage`, url: absolute(site, '/cast'), name: title, description: desc, inLanguage: 'fa-IR', isPartOf: { '@id': ids(site).site } }];
  const body = `<h1>بازیگران ${escapeHtml(site.name)}</h1><p>${escapeHtml(desc)}</p>${cast.length ? cast.map((c) => `<section class="card" id="${escapeHtml(c.id)}"><h2>${escapeHtml(c.name)}</h2>${c.role ? `<p class="meta">${escapeHtml(c.role)}</p>` : ''}<p>${escapeHtml(c.bio)}</p></section>`).join('') : '<p>به‌زودی معرفی می‌شوند.</p>'}`;
  return layout(site, head(site, { title, description: desc, path: '/cast', nodes, crumbs }), crumbs, body);
}

/** The privacy policy (needed for the store listings). Facts only: what the app really stores, from `users` and the chat/ledger tables. */
export function privacyPage(site: Site): string {
  const title = `سیاست حریم خصوصی ${site.name}`;
  const desc = description(`${site.name} چه اطلاعاتی از بازیکن‌ها نگه می‌دارد، برای چه کاری و چطور می‌شود آن را پاک کرد.`);
  const crumbs: Crumb[] = [{ name: 'صفحه‌ی اول', path: '/' }, { name: 'حریم خصوصی' }];
  const n = escapeHtml(site.name);
  const contact = site.contactEmail ? `از راه ایمیل <a href="mailto:${escapeHtml(site.contactEmail)}">${escapeHtml(site.contactEmail)}</a> با ما در تماس باش.` : 'از راه بخش پیام‌های برنامه یا کانال رسمی بازی با ما در تماس باش.';
  const nodes: Record<string, unknown>[] = [{ '@type': 'WebPage', '@id': `${site.url}/privacy#webpage`, url: absolute(site, '/privacy'), name: title, description: desc, inLanguage: 'fa-IR', isPartOf: { '@id': ids(site).site } }];
  const body = `<h1>${escapeHtml(title)}</h1>
<p>${n} یک بازی آنلاین فارسی است. این صفحه ساده می‌گوید چه چیزی نگه می‌داریم و چرا. ما اطلاعات تو را نمی‌فروشیم و در برنامه آگهی یا ردیاب شخص ثالث نمی‌گذاریم.</p>
<h2>چه اطلاعاتی نگه می‌داریم؟</h2>
<ul>
<li><strong>برای بازی کردن لازم است:</strong> یک شناسه‌ی تصادفی دستگاه (برای ساختن حساب مهمان)، نام مستعار و آواتار، پیشرفت، امتیازها، سکه‌ها و تاریخچه‌ی بازی‌ها.</li>
<li><strong>اگر خودت بدهی (اختیاری):</strong> جنسیت، تاریخ تولد، شهر، شماره‌ی تلفن (با کد پیامکی تأیید می‌شود)، ایمیل و اتصال حساب به بله.</li>
<li><strong>گفت‌وگو و گزارش‌ها:</strong> پیام‌هایی که در گفت‌وگوها می‌فرستی و گزارش‌هایی که می‌دهی یا درباره‌ات داده می‌شود، تا بتوانیم رفتار نادرست را بررسی کنیم.</li>
<li><strong>پیشنهادها:</strong> کالا یا قیمتی که برای بازی پیشنهاد می‌کنی و رأی‌هایی که می‌دهی.</li>
</ul>
<h2>برای چه کاری از آن‌ها استفاده می‌کنیم؟</h2>
<p>برای اجرای بازی (حریف‌یابی، جدول رتبه‌ها، دوستان)، پرداخت جایزه‌ها و سکه‌ها، جلوگیری از تقلب و آزار و بهتر کردن بازی. شماره‌ی تلفن فقط برای ورود، پیدا کردن دوست‌ها و ارسال کد تأیید به کار می‌رود.</p>
<h2>به چه کسی داده می‌شود؟</h2>
<p>نام مستعار، آواتار و سطح تو برای بازیکن‌های دیگر دیده می‌شود. اطلاعات خصوصی مثل تلفن و ایمیل برای بازیکن‌های دیگر نمایش داده نمی‌شود. پیامک تأیید ممکن است از راه یک سرویس پیامکی ایرانی فرستاده شود و پیام‌های بله از راه ربات بله. اطلاعاتی برای تبلیغ به کسی نمی‌دهیم.</p>
<h2>چقدر نگه می‌داریم و چطور پاک می‌شود؟</h2>
<p>تا وقتی حساب داری. هر وقت خواستی از «تنظیمات» برنامه، گزینه‌ی حذف حساب را بزن؛ بعد از تأیید با کد، اطلاعات شخصی (نام، تلفن، ایمیل، شناسه) پاک می‌شود و حساب بسته می‌شود. بخشی از سابقه‌ی بی‌نام بازی‌ها و تراکنش‌های سکه برای صحت جدول‌ها می‌ماند.</p>
<h2>امنیت</h2>
<p>ارتباط برنامه با سرور رمزگذاری‌شده (https) است. با این حال هیچ سیستمی صددرصد امن نیست؛ اگر مشکلی دیدی به ما خبر بده.</p>
<h2>تماس</h2>
<p>${contact}</p>
<p class="meta">این متن ممکن است با تغییر بازی به‌روز شود؛ تاریخ آخرین بازبینی نسخه‌ی سایت، همین صفحه است.</p>`;
  return layout(site, head(site, { title, description: desc, path: '/privacy', nodes, crumbs }), crumbs, body);
}

export function notFoundPage(site: Site): string {
  const body = `<h1>این صفحه پیدا نشد</h1><p>نشانی را اشتباه نوشته‌ای یا صفحه جابه‌جا شده. از این‌جا ادامه بده:</p><p><a href="/">صفحه‌ی اول ${escapeHtml(site.name)}</a> · <a href="/blog">مقاله‌های بلاگ</a> · <a href="/cast">بازیگران</a></p>`;
  return layout(site, head(site, { title: `صفحه پیدا نشد | ${site.name}`, description: 'این صفحه وجود ندارد.', path: '/404', noindex: true }), null, body);
}

export function unavailablePage(site: Site): string {
  const body = `<h1>${escapeHtml(site.name)} برمی‌گردد</h1><p>نگران نباش؛ سایت برای چند دقیقه در دسترس نیست و به‌زودی برمی‌گردیم.</p>`;
  return layout(site, head(site, { title: `به‌زودی برمی‌گردیم | ${site.name}`, description: 'سایت موقتاً در دسترس نیست.', path: '/', noindex: true }), null, body);
}

export type { FaqPair };
