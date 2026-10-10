import type { CastMember, LandingData, PostSummary, PublicComment, ServerStatus, SiteStats } from './api.js';
import { commentsSection, faDate, faInt, faNum } from './blocks.js';
import type { Flash } from './blocks.js';
import { escapeHtml } from './markdown.js';
import { BANNERS, HOW_TO, castOf, img, layout, li, promo, webPage } from './pages.js';
import type { NavKey } from './pages.js';
import { absolute, description, head } from './seo.js';
import type { Crumb, Site } from './seo.js';

/**
 * The pages added after the first release: HTML site map, server status, public stats, guides, press kit and one page per cast member.
 * Same rules as `pages.ts`: markup only here and there, every fact real, and nothing needs scripts.
 */

interface PageSpec {
  path: string;
  title: string;
  description: string;
  type?: string;
  crumbs: Crumb[];
  body: string;
  nodes?: Record<string, unknown>[];
  active?: NavKey;
  noindex?: boolean;
}
const page = (site: Site, p: PageSpec): string => {
  const desc = description(p.description);
  const nodes = [webPage(site, p.path, p.type ?? 'WebPage', p.title, desc), ...(p.nodes ?? [])];
  return layout(site, head(site, { title: p.title, description: desc, path: p.path, nodes, crumbs: p.crumbs, noindex: p.noindex }), p.crumbs, p.body, { active: p.active });
};
const home: Crumb = { name: 'صفحه‌ی اول', path: '/' };

/* ---- site map (HTML) ---- */

/** The routes listed on the HTML site map and in `sitemap.xml`: one list so the two can never drift apart. */
export const STATIC_PAGES: { path: string; label: string; note: string; group: 'game' | 'live' | 'about' | 'legal' }[] = [
  { path: '/', label: 'صفحه‌ی اول', note: 'معرفی بازی و پازل نمونه', group: 'game' },
  { path: '/ages', label: 'رده‌های سنی', note: 'فضای کودک، نوجوان و بزرگسال و راهنمای والدین', group: 'game' },
  { path: '/download', label: 'دانلود', note: 'نصب رایگان روی گوشی و وب', group: 'game' },
  { path: '/how-to-play', label: 'راهنمای بازی', note: 'قدم‌به‌قدم، از اولین حدس تا برد', group: 'game' },
  { path: '/modes', label: 'حالت‌های بازی', note: 'تکی، روزانه، زنده، دو در دو، میز خصوصی و تورنومنت', group: 'game' },
  { path: '/glossary', label: 'واژه‌نامه', note: 'قیمت اسمی، ریال و تومان و بقیه‌ی اصطلاح‌ها', group: 'game' },
  { path: '/stats', label: 'آمار بازی', note: 'شمار واقعی کالا، قیمت، پازل و استان', group: 'live' },
  { path: '/status', label: 'وضعیت سرورها', note: 'الان همه چیز کار می‌کند؟', group: 'live' },
  { path: '/blog', label: 'وبلاگ', note: 'مقاله‌ها درباره‌ی قیمت‌های قدیمی', group: 'about' },
  { path: '/cast', label: 'آدم‌های بازار', note: 'شخصیت‌های بازی', group: 'about' },
  { path: '/about', label: 'درباره ما', note: 'قصه‌ی اسم و ایده‌ی بازی', group: 'about' },
  { path: '/press', label: 'رسانه و لوگو', note: 'تصویر، رنگ و متن آماده برای انتشار', group: 'about' },
  { path: '/contact', label: 'تماس و سوالات', note: 'پرسش‌های متداول و راه ارتباط', group: 'about' },
  { path: '/terms', label: 'قوانین و شرایط', note: '', group: 'legal' },
  { path: '/privacy', label: 'حریم خصوصی', note: '', group: 'legal' },
];

export function sitemapPage(site: Site, posts: PostSummary[], cast: CastMember[]): string {
  const link = (href: string, label: string, note = '') => `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a>${note ? `<small>${escapeHtml(note)}</small>` : ''}</li>`;
  const group = (g: string) => STATIC_PAGES.filter((p) => p.group === g).map((p) => link(p.path, p.label, p.note)).join('');
  const section = (title: string, color: string, items: string) => `<section><h2 style="color:${color}">${escapeHtml(title)}</h2><ul>${items}</ul></section>`;
  const machine = [link('/sitemap.xml', 'sitemap.xml', 'نقشه‌ی ماشینی برای موتورهای جست‌وجو'), link('/llms.txt', 'llms.txt', 'معرفی کوتاه برای دستیارهای هوش مصنوعی'), link('/llms-full.txt', 'llms-full.txt', 'متن کامل مقاله‌ها'), link('/feed.xml', 'خبرخوان RSS', 'تازه‌ترین مقاله‌ها'), link('/robots.txt', 'robots.txt')].join('');
  const body = `<h1>نقشه‌ی سایت ${escapeHtml(site.name)}</h1><p>همه‌ی صفحه‌های سایت یک‌جا؛ از راهنمای بازی تا مقاله‌ها و شخصیت‌ها. ${faNum(STATIC_PAGES.length + posts.length + cast.length)} صفحه.</p>
<div class="smap">
${section('بازی', '#FF4D8D', group('game'))}
${section('زنده', '#3FC1F0', group('live'))}
${section('درباره‌ی ما', '#FF7A3D', group('about'))}
${section('شخصیت‌ها', '#7ED957', cast.length ? cast.map((c) => link(`/cast/${encodeURIComponent(c.id)}`, c.name, c.role)).join('') : '<li>به‌زودی</li>')}
${section('مقاله‌ها', '#A66BF0', posts.length ? posts.map((p) => link(`/blog/${encodeURIComponent(p.slug)}`, p.title)).join('') : '<li>به‌زودی</li>')}
${section('قانونی', '#FFC93C', group('legal'))}
${section('برای ماشین‌ها', '#2B1240', machine)}
</div>`;
  return page(site, { path: '/sitemap', title: `نقشه‌ی سایت | ${site.name}`, description: `فهرست همه‌ی صفحه‌های ${site.name}: بازی، راهنما، آمار، وضعیت سرور، مقاله‌ها و شخصیت‌ها.`, type: 'CollectionPage', crumbs: [home, { name: 'نقشه‌ی سایت' }], body });
}

/* ---- status ---- */

export type Level = 'ok' | 'warn' | 'down';
export interface ServiceLine {
  name: string;
  level: Level;
  note: string;
}
export interface StatusReport {
  overall: Level;
  checkedAt: number;
  services: ServiceLine[];
  /** Round trip of the probe to the game server, in ms (null when it did not answer). */
  latencyMs: number | null;
}

/** Turns one live probe of the game server into the report shown on `/status` and `/status.json`. Pure: the clock is a parameter. */
export function buildStatus(probe: { reachable: boolean; ms: number; status: ServerStatus | null }, now: number): StatusReport {
  const s = probe.status;
  const api: ServiceLine = !probe.reachable ? { name: 'سرور بازی', level: 'down', note: 'پاسخ نمی‌دهد' } : s ? { name: 'سرور بازی', level: 'ok', note: 'پاسخ می‌دهد' } : { name: 'سرور بازی', level: 'warn', note: 'پاسخ ناقص می‌دهد' };
  const db: ServiceLine = s ? (s.db === 'ok' ? { name: 'پایگاه داده', level: 'ok', note: 'سالم' } : { name: 'پایگاه داده', level: 'down', note: 'در دسترس نیست' }) : { name: 'پایگاه داده', level: probe.reachable ? 'warn' : 'down', note: 'نامشخص' };
  const maint: ServiceLine = s ? (s.maintenance ? { name: 'حالت تعمیر', level: 'warn', note: 'بازی موقتاً برای به‌روزرسانی بسته است' } : { name: 'حالت تعمیر', level: 'ok', note: 'خاموش؛ بازی باز است' }) : { name: 'حالت تعمیر', level: 'warn', note: 'نامشخص' };
  const services = [{ name: 'سایت معرفی', level: 'ok' as Level, note: 'همین صفحه را از آن می‌خوانی' }, api, db, maint];
  const overall: Level = services.some((x) => x.level === 'down') ? 'down' : services.some((x) => x.level === 'warn') ? 'warn' : 'ok';
  return { overall, checkedAt: now, services, latencyMs: probe.reachable ? probe.ms : null };
}

const LEVEL_TEXT: Record<Level, string> = { ok: 'همه‌ی سرویس‌ها سالم‌اند', warn: 'بعضی سرویس‌ها محدودند', down: 'مشکل در سرویس' };
const DOT: Record<Level, string> = { ok: 'سالم', warn: 'محدود', down: 'قطع' };
const faClock = (ms: number): string => new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Tehran' }).format(ms);
const faDuration = (sec: number): string => {
  const d = Math.floor(sec / 86_400);
  const h = Math.floor((sec % 86_400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${faNum(d)} روز و ${faNum(h)} ساعت` : h > 0 ? `${faNum(h)} ساعت و ${faNum(m)} دقیقه` : `${faNum(m)} دقیقه`;
};

export function statusPage(site: Site, report: StatusReport, uptimeSec: number | null): string {
  const body = `<div class="sbanner ${report.overall}"><span class="sdot ${report.overall}" aria-hidden="true"></span><h1>${LEVEL_TEXT[report.overall]}</h1></div>
<p>این صفحه همین الان از سایت معرفی به سرور بازی سر می‌زند و نتیجه را نشان می‌دهد؛ تاریخچه ندارد. آخرین بررسی: <time datetime="${new Date(report.checkedAt).toISOString()}">${escapeHtml(faClock(report.checkedAt))}</time> (صفحه هر یک دقیقه خودش تازه می‌شود).</p>
<ul class="svc">${report.services.map((s) => `<li><span><span class="sdot ${s.level}" aria-hidden="true"></span><b>${escapeHtml(s.name)}</b> <small>— ${escapeHtml(s.note)}</small></span><span>${DOT[s.level]}</span></li>`).join('')}</ul>
<ul class="stg">
${report.latencyMs !== null ? `<li><b>${faNum(report.latencyMs)}</b><span>میلی‌ثانیه</span><small>زمان پاسخ سرور بازی به این بررسی</small></li>` : ''}
${uptimeSec !== null ? `<li><b style="font-size:30px">${escapeHtml(faDuration(uptimeSec))}</b><span>روشن بودن پیوسته‌ی سرور بازی</span><small>از آخرین راه‌اندازی</small></li>` : ''}
</ul>
<p>خروجی ماشینی همین وضعیت در <a href="/status.json">status.json</a> است. اگر مشکلی می‌بینی که این‌جا سالم نشان داده می‌شود، از <a href="/contact">صفحه‌ی تماس</a> بگو.</p>
<script>setTimeout(function(){location.reload()},60000)</script>`;
  return page(site, { path: '/status', title: `وضعیت سرورها | ${site.name}`, description: `وضعیت زنده‌ی سرور بازی، پایگاه داده و حالت تعمیر ${site.name}.`, crumbs: [home, { name: 'وضعیت سرورها' }], body });
}

/* ---- stats ---- */

export function statsPage(site: Site, stats: SiteStats | null, commentCount: number): string {
  const tiles: [string, string, string][] = stats
    ? [
        [faInt(stats.products), 'کالا', 'کالاهای فعال کاتالوگ'],
        [faInt(stats.prices), 'قیمت تأییدشده', 'هر عدد همان قیمت اسمی همان سال است'],
        ...(stats.years ? ([[`${faNum(stats.years.from)} تا ${faNum(stats.years.to)}`, 'بازه‌ی سال‌ها', 'سال‌های شمسی که قیمتشان را داریم']] as [string, string, string][]) : []),
        [faInt(stats.puzzles), 'پازل آماده', 'هر کدام ۱۶ کالا در ۴ گروه'],
        [faInt(stats.provinces), 'استان و شهر', 'در سفر بازی'],
        [faInt(stats.players), 'بازیکن', 'حساب‌های فعال'],
        [faInt(stats.posts), 'مقاله', 'در وبلاگ'],
        [faInt(commentCount), 'نظر', 'روی مقاله‌ها و صفحه‌ی شخصیت‌ها'],
      ]
    : [];
  const body = `<h1>آمار ${escapeHtml(site.name)}</h1><p>عددهای زیر مستقیم از خود بازی گرفته شده‌اند و حدسی یا گرد‌شده‌ی تبلیغاتی نیستند${stats ? `؛ آخرین به‌روزرسانی: ${escapeHtml(faDate(stats.at))}` : ''}.</p>
${stats ? `<ul class="stg">${tiles.map(([n, label, note]) => `<li><b${n.includes('تا') ? ' style="font-size:32px"' : ''}>${n}</b><span>${escapeHtml(label)}</span><small>${escapeHtml(note)}</small></li>`).join('')}</ul>` : '<p>الان نمی‌توانیم آمار را از سرور بازی بگیریم؛ کمی بعد دوباره سر بزن. <a href="/status">وضعیت سرورها</a></p>'}
<p>قیمت‌ها اسمی‌اند (همان عدد روی برچسب آن سال، بدون تعدیل تورم). برای دیدن وضعیت سرورها به <a href="/status">صفحه‌ی وضعیت</a> برو.</p>`;
  return page(site, { path: '/stats', title: `آمار بازی ${site.name}: کالا، قیمت، پازل`, description: `شمار واقعی کالاها، قیمت‌ها، پازل‌ها و استان‌های ${site.name}.`, crumbs: [home, { name: 'آمار' }], body });
}

/* ---- guides ---- */

const TIPS = ['اول گروه‌های «بی‌دردسر» را پیدا کن؛ مثلاً کالاهایی که قیمتشان در یک سال است. گروه آسان، حدس‌های بعدی را راحت‌تر می‌کند.', 'حواست به کالای «طعمه» باشد: بعضی کالاها به دو گروه می‌خورند ولی فقط یک جا درست‌اند.', 'وقتی پیام «۳ تا از ۴ تا درسته» آمد، یکی از چهارتا را عوض کن، نه همه را.', 'اشتباه‌ها محدودند؛ حدس را وقتی بزن که از قاعده‌اش مطمئنی.'];

export function howToPage(site: Site): string {
  const n = escapeHtml(site.name);
  const steps = [...HOW_TO.map(([t, d]) => [t, d] as const), ['ببین بعد از بازی چه شد', 'در پایان نمودار قیمت کالاها را می‌بینی و می‌فهمی هر گروه چه قاعده‌ای داشت.'] as const];
  const howTo = { '@type': 'HowTo', name: `چطور ${site.name} بازی کنیم`, inLanguage: 'fa-IR', step: steps.map(([t, d], i) => ({ '@type': 'HowToStep', position: i + 1, name: t, text: d })) };
  const body = `<h1>راهنمای بازی ${n}</h1><p>${n} یک جدول ۱۶تایی است: ۱۶ کالا که باید در ۴ گروه چهارتایی بچینی. هر کالا یک قیمت واقعی از یکی از سال‌های گذشته ایران دارد و قاعده‌ی هر گروه را خودت باید پیدا کنی.</p>
<ol class="guide">${steps.map(([t, d]) => `<li><h3>${escapeHtml(t)}</h3><p>${escapeHtml(d)}</p></li>`).join('')}</ol>
<h2>چند نکته برای بهتر بازی کردن</h2><ul>${li(TIPS.map(escapeHtml))}</ul>
<p>برای آشنایی با هر حالت به <a href="/modes">حالت‌های بازی</a> سر بزن و اگر اصطلاحی را نمی‌دانی، <a href="/glossary">واژه‌نامه</a> کمکت می‌کند.</p>
${promo('lime', 'آماده‌ای؟', 'اولین جدولت را همین الان بازی کن.', '<a class="btn big dark" href="/download">شروع بازی</a>')}`;
  return page(site, { path: '/how-to-play', title: `راهنمای بازی ${site.name}: قدم‌به‌قدم`, description: `یاد بگیر ${site.name} چطور بازی می‌شود: ۱۶ کالا، ۴ گروه، حدس و اشتباه‌های محدود، و نکته‌هایی برای برد.`, nodes: [howTo], crumbs: [home, { name: 'راهنمای بازی' }], body });
}

const MODES: [string, string, string][] = [
  ['بازی تکی', '#FFC93C', 'تنها با خودت؛ جدول را حل کن و ببین چند اشتباه می‌کنی. تعداد اشتباه مجاز محدود است.'],
  ['چالش روزانه', '#7ED957', 'هر روز یک جدول تازه برای همه؛ نتیجه‌ات را با رفقا مقایسه کن.'],
  ['زنده دونفره', '#3FC1F0', 'رو در رو با یک حریف، نوبتی. هر کس گروه درست بزند امتیاز می‌گیرد و اگر برابر شدید، حدس قیمت تعیین‌کننده است.'],
  ['دو در دو', '#FF4D8D', 'تیمی با یک هم‌تیمی؛ هماهنگی مهم‌تر از سرعت است.'],
  ['میز خصوصی', '#A66BF0', 'با رفقا و فامیل یک میز بساز و با کد دعوت کن.'],
  ['تورنومنت', '#FF7A3D', 'مسابقه‌های ویژه با جایزه؛ بعضی را اسپانسرها حمایت می‌کنند.'],
];

export function modesPage(site: Site): string {
  const body = `<h1>حالت‌های بازی ${escapeHtml(site.name)}</h1><p>یک بازی، چند جور بازی کردن؛ از تنهایی تا دورهمی.</p>
<ul class="cards4">${MODES.map(([t, c, d]) => `<li class="tile cream"><div class="n" style="color:${c}">●</div><h3>${escapeHtml(t)}</h3><p>${escapeHtml(d)}</p></li>`).join('')}</ul>
<p>همه‌ی داوری‌ها، امتیازها و سکه‌ها سمت سرور حساب می‌شود، پس بازی منصفانه است. قاعده‌ها را در <a href="/how-to-play">راهنمای بازی</a> ببین.</p>`;
  const list = { '@type': 'ItemList', itemListElement: MODES.map(([t, , d], i) => ({ '@type': 'ListItem', position: i + 1, name: t, description: d })) };
  return page(site, { path: '/modes', title: `حالت‌های بازی ${site.name}: تکی، زنده، دو در دو`, description: `بازی تکی، چالش روزانه، زنده دونفره، دو در دو، میز خصوصی و تورنومنت؛ حالت‌های ${site.name} را بشناس.`, type: 'CollectionPage', nodes: [list], crumbs: [home, { name: 'حالت‌های بازی' }], body });
}

const TERMS: [string, string][] = [
  ['قیمت اسمی', 'همان عددی که آن سال روی برچسب کالا بود؛ با تورم تعدیل نشده و با قیمت امروز مقایسه نمی‌شود.'],
  ['ریال', 'واحد پول رسمی ایران؛ قیمت‌ها در پایگاه داده بازی به‌صورت عدد صحیح ریال نگه داشته می‌شوند.'],
  ['تومان', 'ده ریال؛ در بازی همه‌ی قیمت‌ها به تومان نشان داده می‌شود چون همه با آن آشنایند.'],
  ['سال شمسی', 'تاریخ همه‌ی قیمت‌ها به سال شمسی (هجری خورشیدی) ثبت شده؛ مثلاً ۱۳۷۵.'],
  ['گروه', 'چهار کالا که یک قاعده‌ی مشترک دارند؛ هر جدول چهار گروه دارد.'],
  ['یکی مونده', 'وقتی از چهار کالای انتخابی سه‌تا درست باشد، بازی می‌گوید «۳ تا از ۴ تا درسته».'],
  ['چالش روزانه', 'جدول مخصوص هر روز که همه یکسان بازی می‌کنند.'],
  ['سکه', 'پول درون بازی که با بازی، پاداش روزانه و گردونه به دست می‌آید.'],
  ['میز خصوصی', 'اتاقی که با کد دعوت می‌سازی تا فقط دوستانت وارد شوند.'],
];

export function glossaryPage(site: Site): string {
  const set = { '@type': 'DefinedTermSet', name: `واژه‌نامه‌ی ${site.name}`, inLanguage: 'fa-IR', hasDefinedTerm: TERMS.map(([t, d]) => ({ '@type': 'DefinedTerm', name: t, description: d })) };
  const body = `<h1>واژه‌نامه‌ی ${escapeHtml(site.name)}</h1><p>اصطلاح‌هایی که در بازی و سایت می‌شنوی.</p>
<dl class="gl">${TERMS.map(([t, d]) => `<div id="${escapeHtml(t.replace(/\s+/g, '-'))}"><dt>${escapeHtml(t)}</dt><dd>${escapeHtml(d)}</dd></div>`).join('')}</dl>`;
  return page(site, { path: '/glossary', title: `واژه‌نامه‌ی ${site.name}: قیمت اسمی، ریال، تومان`, description: `معنی اصطلاح‌های ${site.name}: قیمت اسمی، ریال و تومان، سال شمسی، گروه و چالش روزانه.`, nodes: [set], crumbs: [home, { name: 'واژه‌نامه' }], body });
}

/* ---- press ---- */

const COLORS: [string, string, string][] = [['مرکب', '#2B1240', '#FFF6E8'], ['کرم', '#FFF6E8', '#2B1240'], ['زرد', '#FFC93C', '#2B1240'], ['نارنجی', '#FF7A3D', '#2B1240'], ['سبز', '#7ED957', '#2B1240'], ['صورتی', '#FF4D8D', '#FFF6E8'], ['آبی', '#3FC1F0', '#2B1240'], ['بنفش', '#A66BF0', '#FFF6E8']];

export function pressPage(site: Site, data: LandingData): string {
  const n = escapeHtml(site.name);
  const blurb = data.site.heroText || site.tagline;
  const body = `<h1>رسانه و لوگوی ${n}</h1><p>هر چیزی که برای نوشتن درباره‌ی ${n} لازم داری. استفاده‌ی خبری و معرفی آزاد است؛ لطفاً تصویرها را تغییر ندهی و نشانی سایت را بیاوری.</p>
<h2>معرفی کوتاه</h2><p>${escapeHtml(blurb)}</p>
<h2>اطلاعات</h2><ul>${li([`نام: ${n}`, `شعار: ${escapeHtml(site.tagline)}`, `نشانی: <span dir="ltr">${escapeHtml(site.url)}</span>`, ...(site.contactEmail ? [`ایمیل: <a href="mailto:${escapeHtml(site.contactEmail)}">${escapeHtml(site.contactEmail)}</a>`] : [])])}</ul>
<h2>لوگو و نماد</h2><div class="kit"><figure><img src="/icons/icon-512.png" alt="نماد ${n}" width="512" height="512" loading="lazy"><figcaption><a href="/icons/icon-512.png" download>نماد ۵۱۲ پیکسل (PNG)</a></figcaption></figure><figure><img src="/banners/og.jpg" alt="کارت اشتراک‌گذاری ${n}" width="1200" height="630" loading="lazy"><figcaption><a href="/banners/og.jpg" download>کارت ۱۲۰۰×۶۳۰ (JPG)</a></figcaption></figure></div>
<h2>بنرها</h2><div class="kit">${BANNERS.map(([b, alt]) => `<figure><img src="/banners/${b}.webp" alt="${escapeHtml(alt)}" width="1600" height="900" loading="lazy"><figcaption><a href="/banners/${b}.webp" download>${escapeHtml(alt)}</a></figcaption></figure>`).join('')}</div>
<h2>رنگ‌ها</h2><div class="sw">${COLORS.map(([name, bg, fg]) => `<span style="background:${bg};color:${fg}" title="${name}">${bg}</span>`).join('')}</div>
<h2>شخصیت‌ها</h2><p>با <a href="/cast">آدم‌های بازار</a> آشنا شو.</p>`;
  return page(site, { path: '/press', title: `رسانه و لوگوی ${site.name}: تصویر و متن آماده`, description: `لوگو، بنر، رنگ‌ها و معرفی کوتاه ${site.name} برای خبرنگارها و وبلاگ‌نویس‌ها.`, crumbs: [home, { name: 'رسانه' }], body });
}

/* ---- one cast member ---- */

export function castMemberPage(site: Site, member: CastMember, all: CastMember[], comments: PublicComment[], flash: Flash): string {
  const path = `/cast/${encodeURIComponent(member.id)}`;
  const idx = all.findIndex((c) => c.id === member.id);
  const who = castOf(all)[idx >= 0 ? idx : 0];
  const photo = who?.image ?? null;
  const others = all.filter((c) => c.id !== member.id).slice(0, 6);
  const crumbs: Crumb[] = [home, { name: 'بازیگران', path: '/cast' }, { name: member.name }];
  const thing = { '@type': 'Thing', '@id': `${absolute(site, path)}#character`, name: member.name, description: member.bio, ...(member.role ? { disambiguatingDescription: member.role } : {}), ...(comments.length ? { comment: comments.slice(0, 20).map((c) => ({ '@type': 'Comment', author: { '@type': 'Person', name: c.author }, dateCreated: new Date(c.createdAt).toISOString(), text: c.body })) } : {}) };
  const body = `<h1>${escapeHtml(member.name)}</h1>${member.role ? `<p class="meta">${escapeHtml(member.role)}</p>` : ''}
<div class="cc">${photo ? `<img class="photo" src="${escapeHtml(photo)}" alt="${escapeHtml(member.name)}" width="110" height="110">` : img(`${who?.who ?? 'dozari'}-idle`, 160, 184, { alt: member.name, eager: true })}<div><p>${escapeHtml(member.bio)}</p></div></div>
${commentsSection('cast', member.id, comments, flash, `نظرت درباره‌ی ${member.name}`)}
${others.length ? `<h2 style="margin-top:40px">بقیه‌ی آدم‌های بازار</h2><ul class="tags">${others.map((c) => `<li><a href="/cast/${encodeURIComponent(c.id)}">${escapeHtml(c.name)}</a></li>`).join('')}</ul>` : ''}`;
  return page(site, { path, title: `${member.name}${member.role ? `، ${member.role}` : ''} | ${site.name}`, description: member.bio || `${member.name} یکی از شخصیت‌های ${site.name} است.`, type: 'ProfilePage', nodes: [{ '@type': 'ProfilePage', '@id': `${absolute(site, path)}#profile`, mainEntity: { '@id': `${absolute(site, path)}#character` } }, thing], crumbs, body, active: undefined });
}

/* ---- feeds ---- */

const xml = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string);

/** `feed.xml` (RSS 2.0) of the published posts, newest first. */
export function rssFeed(site: Site, posts: PostSummary[]): string {
  const items = posts
    .slice(0, 30)
    .map((p) => {
      const url = xml(absolute(site, `/blog/${encodeURIComponent(p.slug)}`));
      return `<item><title>${xml(p.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate><description>${xml(p.summary)}</description></item>`;
    })
    .join('\n');
  const built = posts.reduce((m, p) => Math.max(m, p.updatedAt), 0);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${xml(`وبلاگ ${site.name}`)}</title><link>${xml(absolute(site, '/blog'))}</link><description>${xml(site.tagline)}</description><language>fa-IR</language>${built ? `<lastBuildDate>${new Date(built).toUTCString()}</lastBuildDate>` : ''}\n${items}\n</channel></rss>\n`;
}

/** RFC 9116 `security.txt`; only when the site has a real contact e-mail. */
export function securityTxt(site: Site, now: number): string | null {
  if (!site.contactEmail) return null;
  return `Contact: mailto:${site.contactEmail}\nExpires: ${new Date(now + 365 * 86_400_000).toISOString()}\nPreferred-Languages: fa, en\nCanonical: ${absolute(site, '/.well-known/security.txt')}\n`;
}

