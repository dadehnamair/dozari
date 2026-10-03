export const ADMIN_SHELL_JS = String.raw`
var VIEWS = {};
`;
export const ADMIN_BOOT_JS = String.raw`
var ICON_D = {
  dashboard: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10', catalog: 'M4 6h16v4H4zM4 14h16v4H4z', prices: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M15 9.5H10.5a1.5 1.5 0 0 0 0 3h3a1.5 1.5 0 0 1 0 3H9',
  inbox: 'M3 5h18v14H3zM3 13h5l1 3h6l1-3h5', sources: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1', daily: 'M3 9h18v4H3zM5 13h14v8H5zM12 9v12',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1', users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5c2.5.5 4 2.5 4 5.5',
  dailypuzzle: 'M3 5h18v14H3zM3 10h18M8 3v4M16 3v4',
  levels: 'M3 20h5v-5h5v-5h5V5h3M3 20h18',
  puzzles: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  socket: 'M4 12h4l3-7 4 14 3-7h2', admins: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4', audit: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3', words: 'M12 3l9 16H3zM12 10v4M12 17v.5', invites: 'M3 8h18v10H3zM3 8l9 6 9-6', bots: 'M12 3v3M7 8h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3zM9 13h.01M15 13h.01M9 17h6', tournaments: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3', taunts: 'M4 5h16v11H9l-5 4z', chatreports: 'M5 4h14v16H5zM9 9h6M9 13h4', badges: 'M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z', shop: 'M4 8h16l-1.5 11h-13zM8 8a4 4 0 0 1 8 0', wheel: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18M3 12h18', cities: 'M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6', bale: 'M21 4L3 11l6 2 2 6 3-4 5 3z', messages: 'M3 5h18v14H3zM3 6l9 7 9-7'
};
var NAV = [
  ['main', 'نگاه کلی'], ['dashboard', 'داشبورد'],
  ['main', 'کاتالوگ و قیمت‌ها'], ['catalog', 'کاتالوگ محصولات'], ['prices', 'بازبینی قیمت‌ها', 'prices'], ['inbox', 'صندوق ربات', 'inbox'], ['sources', 'منبع‌های ربات'],
  ['main', 'پازل و بازی'], ['puzzles', 'ساخت پازل'], ['dailypuzzle', 'پازل روز'], ['levels', 'جاده‌ی لول‌ها'], ['tournaments', 'تورنومنت‌ها'], ['taunts', 'کل‌کل‌های آماده'],
  ['main', 'اقتصاد و جایزه'], ['daily', 'جایزه‌ی روزانه'], ['shop', 'فروشگاه'], ['wheel', 'گردونه‌ی شانس'], ['badges', 'نشان‌ها و مدال‌ها'], ['invites', 'کد معرف'],
  ['main', 'بازیکن‌ها و ارتباط'], ['users', 'کاربران'], ['bots', 'بازیکن‌های ربات'], ['cities', 'شهرها'], ['messages', 'مرکز پیام'], ['chatreports', 'گزارش‌های چت'],
  ['main', 'سیستم'], ['settings', 'تنظیمات'], ['words', 'فیلتر کلمات'], ['bale', 'ربات بله'], ['socket', 'سرویس سوکت'], ['admins', 'مدیران پنل'], ['audit', 'گزارش تغییرها']
];
var DESC = {
  dashboard: 'خلاصه‌ی وضعیت بازی: بازیکن‌ها، کاتالوگ، ربات‌ها و کارهای در انتظار.',
  catalog: 'همه‌ی کالاهای بازی با قیمت هر سال. کالا و قیمت تازه از همین‌جا اضافه می‌شود.',
  prices: 'قیمت‌هایی که منتظر تأیید شما هستند؛ تا تأیید نشوند وارد پازل نمی‌شوند.',
  inbox: 'پیشنهادهای ربات برای کالا و قیمت. هر کدام را تأیید یا رد کنید.',
  sources: 'سایت‌هایی که ربات از آن‌ها قیمت جمع می‌کند.',
  puzzles: 'پازل دستی یا خودکار بسازید. هر پازل ۱۶ کالا در ۴ دسته‌ی چهارتایی است.',
  dailypuzzle: 'تم‌های پازل روز و برنامه‌ی روزها.',
  levels: 'جاده‌ی لول‌ها: امتیاز (XP) لازم و جایزه‌ی هر لول.',
  tournaments: 'مسابقه‌ی زمان‌دار با ورودی و جایزه‌ی مشخص.',
  taunts: 'جمله‌های آماده‌ای که بازیکن‌ها بدون چت آزاد برای هم می‌فرستند.',
  daily: 'جایزه‌ی هر روز از ورود پشت‌سرهم.',
  shop: 'آیتم‌هایی که بازیکن با سکه یا الماس می‌خرد، و متن راهنمای فروشگاه.',
  wheel: 'جایزه‌های روی گردونه: نوع، مقدار و شانس هر قطعه.',
  badges: 'نشان‌ها و مدال‌هایی که بازیکن با رسیدن به شرط می‌گیرد.',
  invites: 'کدهای معرف شخصی و کدهای کمپین برای جذب بازیکن.',
  users: 'جست‌وجو و مدیریت بازیکن‌ها: سکه، وضعیت، یادداشت.',
  bots: 'بازیکن‌های ساختگی که وقتی حریف انسانی نیست جای خالی را پر می‌کنند.',
  cities: 'فهرست شهرهایی که بازیکن در پروفایلش انتخاب می‌کند.',
  messages: 'پیام همگانی یا هدفمند برای بازیکن‌ها از چند کانال. تاریخچه‌ی ارسال‌ها هم اینجاست.',
  chatreports: 'گزارش‌هایی که بازیکن‌ها از پیام‌های چت داده‌اند.',
  settings: 'عددها و زمان‌های بازی (اقتصاد، ربات، صف…). تغییر بلافاصله اعمال می‌شود.',
  words: 'کلمه‌های توهین‌آمیزی که در متن بازیکن‌ها مسدود می‌شود.',
  bale: 'اتصال ربات بله و تنظیم اعلان‌ها.',
  socket: 'وضعیت زنده‌ی سرویس سوکت (بازی لحظه‌ای).',
  admins: 'حساب مدیران پنل و نقش هر کدام.',
  audit: 'فهرست همه‌ی تغییرهایی که مدیرها داده‌اند، با نام و زمان.'
};
var TITLES = { puzzles: 'ساخت پازل', dashboard: 'داشبورد', catalog: 'کاتالوگ محصولات', prices: 'بازبینی قیمت‌ها', inbox: 'صندوق پیشنهادهای ربات', sources: 'منبع‌های ربات', daily: 'جایزه‌ی روزانه', levels: 'جاده‌ی لول‌ها', users: 'کاربران', settings: 'تنظیمات', socket: 'سرویس سوکت', audit: 'گزارش تغییرها', admins: 'مدیران پنل', words: 'فیلتر کلمات توهین‌آمیز', cities: 'شهرهای بازی', shop: 'فروشگاه و راهنما', wheel: 'گردونه‌ی شانس', dailypuzzle: 'پازل روز', invites: 'کدهای معرف', badges: 'نشان‌ها و مدال‌ها', taunts: 'کل‌کل‌های آماده', tournaments: 'تورنومنت‌ها', bots: 'بازیکن‌های ربات', chatreports: 'گزارش‌های چت', bale: 'ربات بله و اعلان‌ها', messages: 'مرکز پیام' };
function navIcon(key) { var s = svgEl('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }); s.appendChild(svgEl('path', { d: ICON_D[key] || ICON_D.dashboard })); return s; }
function drawNav() {
  var nav = clear($('nav'));
  NAV.forEach(function (n) {
    if (n[0] === 'admins' && !(S.me && S.me.permissions.indexOf('system') >= 0)) return;
    if (n[0] === 'main') return nav.appendChild(h('div', { class: 'nav-title', text: n[1] }));
    var c = n[2] ? S.counts[n[2]] : 0;
    nav.appendChild(h('a', { href: '#/' + n[0], 'aria-current': S.route === n[0] ? 'page' : null, onclick: function () { document.body.classList.remove('nav-open'); } }, [navIcon(n[0]), h('span', { text: n[1] }), c ? h('span', { class: 'count', text: fa(c) }) : null]));
  });
}
function refreshCounts() {
  api('/admin/dashboard').then(function (r) { if (!r.ok) return; S.counts = { prices: r.body.catalog.pricesPending, inbox: r.body.bot.candidatesPending }; drawNav(); });
}
function route() {
  var r = (location.hash || '#/dashboard').replace(/^#\//, '').split('?')[0];
  if (!VIEWS[r]) r = 'dashboard';
  S.route = r;
  $('title').textContent = TITLES[r] || '';
  drawNav();
  var root = clear($('view'));
  if (DESC[r]) root.appendChild(h('p', { class: 'page-desc', text: DESC[r] }));
  VIEWS[r](root);
  window.scrollTo(0, 0);
}
function setTheme(t) { S.theme = t; if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme'); store('theme', t); }
var tokenMode = false;
function showLogin(msg) {
  $('app').hidden = true; $('login').hidden = false;
  $('login-msg').textContent = msg || '';
  (tokenMode ? $('login-token') : $('login-user')).focus();
}
function setLoginMode(tm) {
  tokenMode = tm;
  $('login-user').hidden = tm; $('login-pass').hidden = tm; $('login-token').hidden = !tm;
  $('login-mode').textContent = tm ? 'ورود با نام کاربری و رمز' : 'ورود با توکن اصلی';
}
var ROLE_FA = { owner: 'مالک', editor: 'ویرایشگر', support: 'پشتیبان', viewer: 'فقط‌خواندن' };
function enter(token) {
  S.token = token;
  api('/admin/me').then(function (m) {
    if (m.status === 401) { sstore('tok', null); S.token = ''; return showLogin('ورود ناموفق بود.'); }
    if (m.status === 404 || !m.ok) { return showLogin('پنل روی این سرور فعال نیست.'); }
    S.me = m.body;
    api('/admin/meta').then(function (r) {
      if (!r.ok) return showLogin('پنل روی این سرور فعال نیست.');
      S.meta = r.body; sstore('tok', token);
      $('who').textContent = S.me.name + ' · ' + (ROLE_FA[S.me.role] || S.me.role);
      $('login').hidden = true; $('app').hidden = false;
      refreshCounts(); route();
    });
  });
}
window.addEventListener('hashchange', route);
$('login-mode').addEventListener('click', function () { setLoginMode(!tokenMode); showLogin(''); });
$('login-form').addEventListener('submit', function (e) {
  e.preventDefault();
  if (tokenMode) { var t = $('login-token').value.trim(); if (t) enter(t); return; }
  var u = $('login-user').value.trim(), p = $('login-pass').value;
  if (!u || !p) return;
  fetch('/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) })
    .then(function (res) { return res.json().catch(function () { return {}; }).then(function (b) { return { status: res.status, body: b }; }); })
    .then(function (r) { $('login-pass').value = ''; if (r.status === 200) return enter(r.body.token); showLogin(ERR[r.body.error] || ('خطا (' + r.status + ')')); })
    .catch(function () { showLogin('اتصال به سرور برقرار نشد.'); });
});
$('logout').addEventListener('click', function () { sstore('tok', null); S.token = ''; S.me = null; showLogin(''); });
$('menu').addEventListener('click', function () { document.body.classList.toggle('nav-open'); });
$('theme').addEventListener('click', function () { var dark = S.theme === 'dark' || (S.theme === null && window.matchMedia('(prefers-color-scheme: dark)').matches); setTheme(dark ? 'light' : 'dark'); });
setTheme(load('theme'));
var saved = sload('tok');
if (saved) enter(saved); else showLogin('');
`;
