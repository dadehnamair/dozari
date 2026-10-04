import type { CastMember, FaqPair, LandingData, Post, PostList, PostSummary } from './api.js';
import { escapeHtml, plainText, renderMarkdown } from './markdown.js';
import { absolute, description, faqNode, head, ids } from './seo.js';
import type { Crumb, Site } from './seo.js';

/** Human-readable Persian date of an epoch-ms instant (Solar Hijri, Tehran). */
export const faDate = (ms: number): string => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tehran' }).format(ms);

const CSS = `
:root{--ink:#2B1240;--cream:#FFF6E8;--yellow:#FFC93C;--orange:#FF7A3D;--lime:#7ED957;--pink:#FF4D8D;--sky:#3FC1F0;--violet:#A66BF0}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;font-family:Vazirmatn,Tahoma,"Segoe UI",system-ui,sans-serif;background:var(--cream);color:var(--ink);line-height:1.9;font-size:17px}
a{color:#7E46D6}a:hover{color:var(--pink)}
h1,h2,h3{font-weight:900;margin:0}
.wrap{max-width:1200px;margin:0 auto;padding:0 24px}
header.top{position:sticky;top:0;z-index:20;background:var(--cream);border-bottom:4px solid var(--ink)}
.bar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:12px 24px;max-width:1200px;margin:0 auto}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);font-weight:900;font-size:32px;line-height:1}
.brand i{width:46px;height:46px;border-radius:50%;background:var(--yellow);border:3px solid var(--ink);display:grid;place-items:center;font-style:normal;font-size:24px}
nav.main{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
nav.main a{font-weight:800;font-size:15px;padding:6px 14px;border-radius:999px;text-decoration:none;color:var(--ink);border:3px solid transparent}
nav.main a[aria-current=page]{background:var(--yellow);border-color:var(--ink)}
.btn{display:inline-block;background:var(--lime);color:var(--ink);font-weight:900;text-decoration:none;border:4px solid var(--ink);border-radius:999px;padding:6px 24px;box-shadow:0 5px 0 var(--ink)}
.btn:hover{color:var(--ink);transform:translateY(2px);box-shadow:0 3px 0 var(--ink)}
.btn.alt{background:var(--yellow)}.btn.pink{background:var(--pink);color:var(--cream)}.btn.pink:hover{color:var(--cream)}
.band{border-bottom:4px solid var(--ink)}.band.yellow{background:var(--yellow)}.band.violet{background:var(--violet);color:var(--cream)}.band.sky{background:var(--sky)}.band.ink{background:var(--ink);color:var(--cream)}
.band .wrap{padding-top:56px;padding-bottom:56px}
.hero-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:40px;align-items:center}
.pill{display:inline-block;font-weight:800;font-size:14px;padding:4px 14px;border:3px solid var(--ink);border-radius:999px;background:var(--cream);color:var(--ink)}
h1{font-size:clamp(38px,6vw,72px);line-height:1.2;text-wrap:balance}
h2{font-size:clamp(30px,4vw,44px);line-height:1.3;margin:1.4em 0 .4em;text-wrap:balance}h3{font-size:22px;line-height:1.5}
.lead{font-size:19px;font-weight:600;max-width:560px}
.cta{display:flex;gap:14px;flex-wrap:wrap;margin-top:16px}
.stage{position:relative;display:grid;place-items:center;min-height:300px}
.stage .disc{position:absolute;width:300px;height:300px;max-width:90%;border-radius:50%;background:var(--orange);border:4px solid var(--ink)}
.stage .coin{position:relative;font-size:150px;line-height:1;filter:drop-shadow(0 6px 0 var(--ink))}
.center{text-align:center}.section{padding:56px 0}.section>h2:first-child,.wrap>h2:first-child{margin-top:0}
.grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));padding:0;list-style:none;margin:20px 0}
.tile{background:#fff;border:4px solid var(--ink);border-radius:28px;padding:22px;box-shadow:0 6px 0 var(--ink)}
.tile .ic{width:64px;height:64px;border-radius:18px;border:3px solid var(--ink);display:grid;place-items:center;font-size:32px;margin-bottom:10px}
.tile p{margin:.3em 0 0;font-size:16px}
.tile .num{width:52px;height:52px;border-radius:50%;background:var(--yellow);border:3px solid var(--ink);display:grid;place-items:center;font-weight:900;font-size:26px;margin-bottom:8px}
.steps{display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));padding:0;list-style:none;margin:24px 0 0}
.steps li{text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px}.steps p{margin:0;font-weight:600;font-size:16px;max-width:280px}
.steps .num{width:56px;height:56px;border-radius:50%;background:var(--yellow);border:3px solid var(--ink);display:grid;place-items:center;font-weight:900;font-size:28px}
.cast{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;background:var(--ink);border-radius:36px;padding:28px 20px;list-style:none;margin:20px 0}
.cast a{display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--cream);text-decoration:none;font-weight:800;min-width:110px}
.cast img{width:84px;height:84px;border-radius:50%;object-fit:cover;background:var(--yellow);border:3px solid var(--cream)}
.cast-photo{float:inline-start;width:96px;height:96px;border-radius:24px;object-fit:cover;border:3px solid var(--ink);margin-inline-end:14px;background:var(--yellow)}
.cast b{width:84px;height:84px;border-radius:50%;background:var(--yellow);border:3px solid var(--cream);display:grid;place-items:center;font-size:36px;color:var(--ink)}
.cards{display:grid;gap:20px;padding:0;list-style:none;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.card{background:#fff;border:4px solid var(--ink);border-radius:28px;padding:20px;box-shadow:0 6px 0 var(--ink)}.card h2,.card h3{margin:.1em 0}.card h3 a{color:var(--ink);text-decoration:none}.card h3 a:hover{color:var(--pink)}
.meta{font-size:14px;opacity:.75;font-weight:600}
.promo{background:var(--pink);color:var(--cream);border:4px solid var(--ink);border-radius:40px;box-shadow:0 8px 0 var(--ink);padding:36px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;margin:56px 0}
.promo h2{margin:0;font-size:clamp(28px,4vw,44px)}.promo p{margin:.2em 0 0;font-weight:600}
main.page{max-width:820px;margin:0 auto;padding:22px 24px 40px}
.crumbs{font-size:14px;margin:6px 0 0;padding:0;list-style:none;display:flex;gap:6px;flex-wrap:wrap}.crumbs li+li::before{content:"‹";margin-inline-end:6px;opacity:.6}
article img.cover{max-width:100%;height:auto;border-radius:20px;border:4px solid var(--ink)}
article h1{font-size:clamp(30px,4.5vw,46px)}
article blockquote{margin:1em 0;padding:.2em 1em;border-inline-start:6px solid var(--yellow);background:#fff;border-radius:8px}
article code{background:#fff;border:1px solid #ddd;border-radius:6px;padding:0 5px;font-family:ui-monospace,monospace}
.toc{background:#fff;border:3px dashed var(--ink);border-radius:18px;padding:8px 18px;margin:14px 0}
details.faq{background:#fff;border:4px solid var(--ink);border-radius:20px;margin:12px 0;box-shadow:0 4px 0 var(--ink)}
details.faq summary{cursor:pointer;font-weight:800;font-size:18px;padding:14px 18px;list-style:none;display:flex;justify-content:space-between;gap:12px}
details.faq summary::after{content:"+";font-weight:900}details.faq[open] summary{background:var(--yellow);border-radius:16px 16px 0 0}details.faq[open] summary::after{content:"−"}
details.faq p{margin:0;padding:12px 18px 16px}
.stores{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));padding:0;list-style:none}
.store{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border:4px solid var(--ink);border-radius:24px;padding:14px 18px;box-shadow:0 5px 0 var(--ink)}
.store .ab{width:52px;height:52px;border-radius:16px;border:3px solid var(--ink);display:grid;place-items:center;font-weight:900;font-size:24px;flex:none}
.store div.t{flex:1;display:flex;flex-direction:column;line-height:1.5}
.req{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:2px dashed rgba(43,18,64,.25)}
.pager{display:flex;gap:12px;justify-content:center;margin-top:18px;font-weight:800}
footer.bottom{background:var(--ink);color:var(--cream);margin-top:40px}
footer.bottom .wrap{padding-top:48px;padding-bottom:24px}
.fgrid{display:grid;gap:32px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
footer.bottom h2{font-size:22px;margin:0 0 8px}footer.bottom ul{list-style:none;padding:0;margin:0}footer.bottom li{margin:4px 0}
footer.bottom a{color:var(--cream);text-decoration:none;font-weight:600}footer.bottom a:hover{color:var(--yellow)}
footer.bottom .brandname{font-size:38px;font-weight:900;color:var(--yellow);line-height:1.2}
.legal{margin-top:28px;padding-top:16px;border-top:2px solid rgba(255,246,232,.2);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13px;opacity:.75;font-weight:600}
@media(max-width:560px){.band .wrap{padding-top:36px;padding-bottom:36px}.promo{padding:24px}}
`;

const li = (items: string[]): string => items.map((i) => `<li>${i}</li>`).join('');

export type NavKey = 'home' | 'about' | 'blog' | 'download' | 'contact';
const NAV: [NavKey, string, string][] = [['home', '/', 'خانه'], ['about', '/about', 'درباره ما'], ['blog', '/blog', 'بلاگ'], ['download', '/download', 'دانلود'], ['contact', '/contact', 'تماس و پرسش‌ها']];

function layout(site: Site, headHtml: string, crumbs: Crumb[] | null, body: string, opts: { active?: NavKey; wide?: boolean } = {}): string {
  const crumbHtml =
    crumbs && crumbs.length > 1
      ? `<nav aria-label="مسیر صفحه"><ol class="crumbs">${li(crumbs.map((c) => (c.path !== undefined ? `<a href="${escapeHtml(c.path)}">${escapeHtml(c.name)}</a>` : `<span aria-current="page">${escapeHtml(c.name)}</span>`)))}</ol></nav>`
      : '';
  const nav = NAV.map(([k, href, label]) => `<a href="${href}"${k === opts.active ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const year = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', timeZone: 'Asia/Tehran' }).format(Date.now());
  const content = opts.wide ? body : `<main class="page">\n${crumbHtml}\n${body}\n</main>`;
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
${headHtml}
<style>${CSS}</style>
</head>
<body>
<header class="top"><div class="bar">
<a class="brand" href="/"><i aria-hidden="true">🪙</i>${escapeHtml(site.name)}</a>
<nav class="main" aria-label="منوی اصلی">${nav}</nav>
<a class="btn pink" href="/download">دانلود رایگان</a>
</div></header>
${opts.wide ? '<main>' : ''}${content}${opts.wide ? '</main>' : ''}
<footer class="bottom"><div class="wrap">
<div class="fgrid">
<div><div class="brandname">${escapeHtml(site.name)}</div><p>${escapeHtml(site.tagline)}</p></div>
<div><h2>صفحه‌ها</h2><ul><li><a href="/">صفحه‌ی اول</a></li><li><a href="/about">درباره‌ی ما</a></li><li><a href="/blog">مقاله‌های بلاگ</a></li><li><a href="/cast">آشنایی با شخصیت‌های بازی</a></li><li><a href="/download">دانلود</a></li><li><a href="/contact">تماس و پرسش‌ها</a></li></ul></div>
<div><h2>قوانین</h2><ul><li><a href="/privacy">حریم خصوصی</a></li></ul></div>
<div><h2>ما را دنبال کن</h2><ul>${site.sameAs.map((u) => `<li><a href="${escapeHtml(u)}" rel="noopener me">${escapeHtml(u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, ''))}</a></li>`).join('')}${site.androidApp ? `<li><a href="${escapeHtml(site.androidApp)}">دانلود برنامه‌ی اندروید</a></li>` : ''}${site.contactEmail ? `<li><a href="mailto:${escapeHtml(site.contactEmail)}">${escapeHtml(site.contactEmail)}</a></li>` : ''}</ul></div>
</div>
<div class="legal"><span>© ${escapeHtml(year)} ${escapeHtml(site.name)}</span><span dir="ltr">${escapeHtml(site.url.replace(/^https?:\/\//, ''))}</span></div>
</div></footer>
</body>
</html>`;
}

const postCard = (p: PostSummary): string =>
  `<li class="card"><span class="meta" style="color:var(--pink)">مقاله</span><h3><a href="/blog/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a></h3><p class="meta">${escapeHtml(faDate(p.publishedAt))}${p.author ? ` · ${escapeHtml(p.author)}` : ''}</p>${p.summary ? `<p>${escapeHtml(p.summary)}</p>` : ''}</li>`;

const HOW_TO = [
  ['کالاها را ببین', 'شانزده کالا روی صفحه است؛ هر کدام یک قیمت واقعی در یکی از سال‌های گذشته ایران دارد.'],
  ['چهارتا چهارتا گروه کن', 'کالاهایی را که یک قاعده‌ی مشترک دارند کنار هم بگذار؛ مثلاً قیمتشان در یک سال یا یک بازه است.'],
  ['حدس بزن و ادامه بده', 'هر گروه درست یک دسته‌ی رنگی می‌شود؛ اشتباه‌ها محدودند.'],
  ['با دوستانت رقابت کن', 'همین بازی را تکی یا زنده دونفره، دو در دو و در تورنومنت بازی کن.'],
] as const;

const FEATURES = [
  ['🪙', '#FFC93C', 'قیمت‌های واقعی', 'قیمت اسمی کالاها در سال‌های گذشته ایران، همان‌طور که روی برچسب بود؛ بدون تعدیل تورم.'],
  ['🧩', '#7ED957', 'شانزده کالا، چهار گروه', 'قاعده‌ی پنهان هر گروه را پیدا کن؛ هر روز یک جدول تازه.'],
  ['⚔️', '#3FC1F0', 'رقابت زنده', 'تکی، زنده دونفره، دو در دو و تورنومنت؛ حریفت را با سرعت و دقت شکست بده.'],
  ['🎩', '#A66BF0', 'ظاهر مخصوص خودت', 'آواتار، کلاه و لباس‌هایی که با سکه‌های بازی به دست می‌آوری.'],
] as const;

/** Western digits to Persian digits. */
const faNum = (n: number): string => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)] as string);

const faqList = (faq: FaqPair[]): string => faq.map((f) => `<details class="faq"><summary><h3 style="font-size:18px">${escapeHtml(f.question)}</h3></summary><p>${escapeHtml(f.answer)}</p></details>`).join('');

/** Real download links only: the web app and the Android file, when the admin has set them. */
function storeButtons(site: Site): string {
  return `${site.appUrl ? `<a class="btn" href="${escapeHtml(site.appUrl)}">همین حالا بازی کن</a>` : ''}${site.androidApp ? `<a class="btn alt" href="${escapeHtml(site.androidApp)}">دانلود برنامه‌ی اندروید</a>` : ''}`;
}

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
  const stores = storeButtons(site);
  const body = `
<section class="band yellow"><div class="wrap hero-grid">
<div><span class="pill">بازی قیمت‌های قدیمی ایران · رایگان</span>
<h1>${escapeHtml(s.heroTitle || s.name)}</h1>
<p class="lead">${escapeHtml(s.heroText)}</p>
<div class="cta">${stores || '<a class="btn" href="/download">دانلود دوزاری</a>'}</div></div>
<div class="stage" aria-hidden="true"><span class="disc"></span><span class="coin">🪙</span></div>
</div></section>
<section class="wrap section"><h2 class="center">چرا ${escapeHtml(s.name)}؟</h2>
<ul class="grid">${FEATURES.map(([ic, bg, t, d]) => `<li class="tile"><div class="ic" style="background:${bg}" aria-hidden="true">${ic}</div><h3>${escapeHtml(t)}</h3><p>${escapeHtml(d)}</p></li>`).join('')}</ul></section>
<section class="band sky" style="border-block:4px solid var(--ink)"><div class="wrap"><h2 class="center" style="margin-top:0">${escapeHtml(s.name)} چطور بازی می‌شود؟</h2>
<ol class="steps">${HOW_TO.map(([n, t], k) => `<li><span class="num" aria-hidden="true">${faNum(k + 1)}</span><h3>${escapeHtml(n)}</h3><p>${escapeHtml(t)}</p></li>`).join('')}</ol></div></section>
${cast.length ? `<section class="wrap section"><h2 class="center" style="margin-top:0">با شخصیت‌های ${escapeHtml(s.name)} آشنا شو</h2><ul class="cast">${cast.slice(0, 8).map((c) => `<li><a href="/cast#${escapeHtml(c.id)}">${c.image ? `<img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}" width="84" height="84" loading="lazy">` : `<b aria-hidden="true">${escapeHtml([...c.name][0] ?? '')}</b>`}${escapeHtml(c.name)}</a></li>`).join('')}</ul><p class="center"><a href="/cast">معرفی کامل بازیگران دوزاری</a></p></section>` : ''}
${latest.length ? `<section class="wrap" style="padding-bottom:24px"><h2 style="margin-top:0">تازه‌ترین مقاله‌های بلاگ</h2><ul class="cards">${latest.map(postCard).join('')}</ul><p><a href="/blog">همه‌ی مقاله‌های بلاگ دوزاری</a></p></section>` : ''}
${faq.length ? `<section class="wrap"><h2>پرسش‌های متداول</h2>${faqList(faq)}</section>` : ''}
<section class="wrap"><div class="promo"><div><h2>همین حالا رایگان بازی کن</h2><p>روی گوشی یا همین مرورگر، بدون ثبت‌نام طولانی.</p></div><a class="btn alt" href="/download">دانلود ${escapeHtml(s.name)}</a></div></section>`;
  return layout(site, head(site, { title, description: desc, path: '/', nodes }), null, body, { active: 'home', wide: true });
}

const webPage = (site: Site, path: string, type: string, title: string, desc: string): Record<string, unknown> => ({ '@type': type, '@id': `${absolute(site, path)}#webpage`, url: absolute(site, path), name: title, description: desc, inLanguage: 'fa-IR', isPartOf: { '@id': ids(site).site } });

export function aboutPage(site: Site): string {
  const title = `درباره‌ی ${site.name}: قصه‌ی اسم و ایده‌ی بازی`;
  const desc = description(`${site.name} یک بازی فارسی درباره‌ی قیمت‌های قدیمی ایران است؛ ببین اسمش از کجا آمده و چه چیزهایی برایمان مهم است.`);
  const crumbs: Crumb[] = [{ name: 'صفحه‌ی اول', path: '/' }, { name: 'درباره‌ی ما' }];
  const n = escapeHtml(site.name);
  const values = [
    ['۰۱', '#FF4D8D', 'قیمت واقعی', 'قیمت‌ها اسمی‌اند، همان عددی که آن سال روی برچسب بود؛ هیچ‌کدام با تورم تعدیل نشده.'],
    ['۰۲', '#3FC1F0', 'بازی منصفانه', 'داوری و امتیاز و سکه همه سمت سرور است؛ تقلب جا ندارد و آگهی یا ردیاب شخص ثالث در برنامه نیست.'],
    ['۰۳', '#A66BF0', 'برای همه‌ی نسل‌ها', 'پدربزرگ‌ها قیمت‌ها را یادشان است و بچه‌ها می‌خواهند بدانند؛ بازی دورهمی را راه می‌اندازد.'],
  ] as const;
  const body = `
<section class="band violet" style="margin:0 -24px"><div class="wrap hero-grid">
<div><span class="pill">درباره‌ی ما</span><h1 style="margin-top:12px">ما عاشق قیمت‌های قدیمی‌ایم</h1>
<p class="lead">${n} را کسانی ساخته‌اند که دلشان برای قیمت نان و سکه و بلیت سینما، برای بازی‌های خانوادگی و قصه‌ی بازار تنگ شده بود. می‌خواستیم بازی‌ای بسازیم که هم سرگرم کند، هم یادمان بیاورد چه روزگاری داشتیم.</p></div>
<div class="stage" aria-hidden="true"><span class="disc"></span><span class="coin">🪙</span></div></div></section>
<h2>قصه‌ی اسم «${n}»</h2>
<p>قدیم‌ها توی تلفن‌های عمومی سکه‌ی دوریالی می‌انداختند و تا سکه نمی‌افتاد تماس وصل نمی‌شد. از همان‌جا اصطلاح «دوزاری‌اش افتاد» آمد؛ یعنی بالاخره فهمید. بازی ما هم همین است: قیمت‌ها را کنار هم می‌گذاری تا ناگهان دوزاری‌ات بیفتد و قاعده‌ی پنهان گروه را ببینی.</p>
<h2>چیزهایی که برایمان مهم است</h2>
<ul class="grid">${values.map(([num, bg, t, d]) => `<li class="tile"><div class="ic" style="background:${bg};color:#fff;font-weight:900;font-size:22px" aria-hidden="true">${num}</div><h3>${escapeHtml(t)}</h3><p>${escapeHtml(d)}</p></li>`).join('')}</ul>
<div class="promo"><div><h2>همکاری یا پیشنهاد داری؟</h2><p>کالا یا قیمتی را که یادت است برایمان بفرست؛ خوشحال می‌شویم بشنویم.</p></div><a class="btn alt" href="/contact">تماس با ما</a></div>`;
  return layout(site, head(site, { title, description: desc, path: '/about', nodes: [webPage(site, '/about', 'AboutPage', title, desc)], crumbs }), crumbs, body, { active: 'about' });
}

export function downloadPage(site: Site): string {
  const title = `دانلود ${site.name}: رایگان برای اندروید و مرورگر`;
  const desc = description(`${site.name} را رایگان روی گوشی اندروید نصب کن یا همین حالا در مرورگر بازی کن.`);
  const crumbs: Crumb[] = [{ name: 'صفحه‌ی اول', path: '/' }, { name: 'دانلود' }];
  const stores = [
    site.appUrl ? { ab: 'W', bg: '#FF7A3D', fa: 'نسخه‌ی وب', os: 'همین حالا در مرورگر', cta: 'بازی آنلاین', href: site.appUrl } : null,
    site.androidApp ? { ab: '↓', bg: '#7ED957', fa: 'برنامه‌ی اندروید', os: 'فایل APK', cta: 'دریافت فایل', href: site.androidApp } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);
  const body = `<h1>دانلود ${escapeHtml(site.name)}</h1><p class="lead">بازی رایگان است و برای شروع به ثبت‌نام طولانی نیاز نداری.</p>
<h2>از کجا دانلود کنم؟</h2>
${stores.length ? `<ul class="stores">${stores.map((x) => `<li><a class="store" href="${escapeHtml(x.href)}" style="color:var(--ink);text-decoration:none"><span class="ab" style="background:${x.bg}" aria-hidden="true">${x.ab}</span><span class="t"><strong>${x.fa}</strong><span class="meta">${x.os}</span></span><span class="btn alt" style="padding:2px 16px">${x.cta}</span></a></li>`).join('')}</ul>` : '<p>لینک‌های دانلود به‌زودی این‌جا قرار می‌گیرند.</p>'}
<h2>چیزهایی که لازم است</h2>
<div class="tile"><div class="req"><span>اتصال اینترنت</span><strong>برای بازی زنده و ذخیره‌ی پیشرفت</strong></div><div class="req" style="border:0"><span>حساب</span><strong>مهمان؛ شماره‌ی تلفن اختیاری است</strong></div></div>`;
  return layout(site, head(site, { title, description: desc, path: '/download', nodes: [webPage(site, '/download', 'WebPage', title, desc)], crumbs }), crumbs, body, { active: 'download' });
}

export function contactPage(site: Site, faq: FaqPair[]): string {
  const title = `تماس با ${site.name} و پرسش‌های متداول`;
  const desc = description(`پاسخ پرسش‌های رایج درباره‌ی ${site.name} و راه‌های تماس با تیم بازی.`);
  const crumbs: Crumb[] = [{ name: 'صفحه‌ی اول', path: '/' }, { name: 'تماس و پرسش‌ها' }];
  const nodes: Record<string, unknown>[] = [webPage(site, '/contact', 'ContactPage', title, desc)];
  const faqN = faqNode(faq);
  if (faqN) nodes.push(faqN);
  const mail = site.contactEmail ? `<a class="btn alt" href="mailto:${escapeHtml(site.contactEmail)}">${escapeHtml(site.contactEmail)}</a>` : '<span class="meta">از بخش پیام‌های برنامه برایمان بنویس.</span>';
  const body = `<h1>تماس و پرسش‌ها</h1><p class="lead">اول ببین جواب سؤالت پایین هست یا نه؛ اگر نبود برایمان بنویس.</p>
<div class="promo" style="margin:24px 0"><div><h2 style="font-size:28px">با ما حرف بزن</h2><p>همکاری، پیشنهاد کالا یا گزارش مشکل</p></div>${mail}</div>
${faq.length ? `<h2>پرسش‌های متداول</h2>${faqList(faq)}` : ''}`;
  return layout(site, head(site, { title, description: desc, path: '/contact', nodes, crumbs }), crumbs, body, { active: 'contact' });
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
  return layout(site, head(site, { title, description: desc, path, nodes, crumbs }), crumbs, body, { active: 'blog' });
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
  return layout(site, head(site, { title, description: desc, path, type: 'article', image: post.coverUrl, nodes: [node], crumbs, publishedTime: post.publishedAt, modifiedTime: post.updatedAt }), crumbs, body, { active: 'blog' });
}

export function castPage(site: Site, cast: CastMember[]): string {
  const title = `بازیگران ${site.name}: شخصیت‌های بازی`;
  const desc = description(`با شخصیت‌ها و آدم‌های ${site.name} آشنا شو: کی راهنمای بازی است و هر کس چه نقشی دارد.`);
  const crumbs: Crumb[] = [{ name: 'صفحه‌ی اول', path: '/' }, { name: 'بازیگران' }];
  const nodes: Record<string, unknown>[] = [{ '@type': 'AboutPage', '@id': `${site.url}/cast#webpage`, url: absolute(site, '/cast'), name: title, description: desc, inLanguage: 'fa-IR', isPartOf: { '@id': ids(site).site } }];
  const body = `<h1>بازیگران ${escapeHtml(site.name)}</h1><p>${escapeHtml(desc)}</p>${cast.length ? cast.map((c) => `<section class="card" id="${escapeHtml(c.id)}">${c.image ? `<img class="cast-photo" src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}" width="96" height="96" loading="lazy">` : ''}<h2>${escapeHtml(c.name)}</h2>${c.role ? `<p class="meta">${escapeHtml(c.role)}</p>` : ''}<p>${escapeHtml(c.bio)}</p></section>`).join('') : '<p>به‌زودی معرفی می‌شوند.</p>'}`;
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
