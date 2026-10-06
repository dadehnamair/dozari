export const ADMIN_SHELL_JS = String.raw`
var VIEWS = {};
/*
 * Information architecture. Seven sections, each with tabs; a tab key is also the key of its view in VIEWS.
 * Tab = [key, label, description, keywords for the quick-jump search].
 * Routes look like #/players/users; old flat links such as #/users are redirected.
 */
var TREE = [
  { id: 'dashboard', title: 'نمای کلی', icon: 'dashboard', tabs: [
    ['dashboard', 'نمای کلی', 'وضعیت بازی، کارهای منتظر تو و میان‌برها', 'داشبورد آمار خانه']
  ] },
  { id: 'players', title: 'بازیکنان و نظارت', icon: 'players', tabs: [
    ['users', 'کاربران', 'جستجو، مسدودسازی، سکه، نشان و یادداشت برای هر بازیکن', 'بازیکن کاربر بن مسدود سکه اسم'],
    ['agetracks', 'رده‌های سنی', 'تعداد بازیکن، پازل و درس کودک در هر رده و وضعیت کلید رده‌ها', 'رده سنی کودک نوجوان بزرگسال ولی'],
    ['userreports', 'گزارش از بازیکن‌ها', 'گزارش‌هایی که بازیکن‌ها از پروفایل هم داده‌اند', 'گزارش پروفایل بازیکن'],
    ['chatreports', 'گزارش‌های چت', 'پیام‌هایی که بازیکن‌ها گزارش کرده‌اند', 'گزارش چت توهین'],
    ['words', 'فیلتر کلمات', 'کلمه‌های ممنوع در چت و اسم', 'فیلتر کلمه توهین ممنوع'],
    ['badges', 'نشان‌ها و مدال‌ها', 'تعریف نشان‌ها و امتیازهایشان', 'نشان مدال'],
    ['bots', 'بازیکن‌های ربات', 'بازیکن‌های ساختگی برای پر کردن صف', 'ربات بازیکن صف'],
    ['invites', 'کد معرف', 'کدهای دعوت و کمپین‌ها', 'کد دعوت معرف کمپین']
  ] },
  { id: 'catalog', title: 'محتوا و قیمت‌ها', icon: 'catalog', tabs: [
    ['catalog', 'کاتالوگ محصولات', 'محصول‌ها، آیکن‌ها و تاریخچه‌ی قیمت', 'محصول کالا آیکن'],
    ['prices', 'بازبینی قیمت‌ها', 'قیمت‌هایی که دستی ثبت شده و منتظر تأییدند', 'قیمت تایید'],
    ['inbox', 'صندوق ربات', 'پیشنهاد قیمت‌هایی که ربات پیدا کرده', 'ربات پیشنهاد صندوق'],
    ['sources', 'منبع‌های ربات', 'جایی که ربات قیمت‌ها را از آن می‌خواند', 'منبع ربات'],
    ['ugc', 'پیشنهاد بازیکن‌ها', 'کالا و قیمتی که بازیکن‌ها پیشنهاد داده‌اند', 'پیشنهاد بازیکن ugc گزارش غلط']
  ] },
  { id: 'game', title: 'بازی و پازل', icon: 'game', tabs: [
    ['puzzles', 'ساخت پازل', 'تولید و ویرایش پازل‌های بازی', 'پازل گروه'],
    ['lessons', 'کلمه‌آموزی کودک', 'متن درس هر آیتم کودک: کلمه، داستان کوتاه و تأیید', 'کودک درس کلمه حرف آموزش'],
    ['dailypuzzle', 'پازل روز', 'برنامه‌ی پازل روزانه و تم‌ها', 'روزانه تم'],
    ['levels', 'جاده‌ی لول‌ها', 'جدول لول، امتیاز و جایزه‌ها', 'لول سطح جاده'],
    ['cities', 'شهرها', 'بازیکن‌ها، آمار و کل‌کل‌های هر شهر', 'شهر استان بازیکن'],
    ['taunts', 'کل‌کل‌های آماده', 'پیام‌های آماده‌ی چت', 'کل‌کل پیام چت']
  ] },
  { id: 'economy', title: 'اقتصاد', icon: 'economy', tabs: [
    ['daily', 'جایزه‌ی روزانه', 'سکه‌ی ورود روزانه و زنجیره', 'جایزه سکه روزانه'],
    ['shop', 'فروشگاه', 'اقلام فروشگاه، بسته‌های سکه و راهنما', 'فروشگاه بسته سکه خرید'],
    ['wheel', 'گردونه‌ی شانس', 'جایزه‌های گردونه', 'گردونه شانس جایزه'],
    ['tournaments', 'تورنومنت‌ها', 'ساخت و مدیریت مسابقه‌های ویژه', 'تورنومنت مسابقه'],
    ['sponsors', 'اسپانسرها', 'اسپانسرهای تورنومنت‌ها', 'اسپانسر حامی بنر']
  ] },
  { id: 'comms', title: 'ارتباط با بازیکن', icon: 'comms', tabs: [
    ['messages', 'مرکز پیام', 'ارسال پیام همگانی و پیگیری گیرنده‌ها', 'پیام اعلان همگانی'],
    ['bale', 'ربات بله', 'وضعیت ربات بله و اعلان‌ها', 'بله اعلان']
  ] },
  { id: 'site', title: 'سایت معرفی و لینک‌ها', icon: 'site', tabs: [
    ['landingposts', 'بلاگ', 'مقاله‌های بلاگ سایت معرفی', 'بلاگ مقاله سایت'],
    ['landingcast', 'بازیگران', 'شخصیت‌های صفحه‌ی بازیگران', 'بازیگران شخصیت'],
    ['landingfaq', 'سوالات متداول', 'پرسش و پاسخ صفحه‌ی اول', 'سوال متداول faq'],
    ['shortlinks', 'لینک کوتاه', 'لینک‌های کوتاه و شمارش کلیک', 'لینک کوتاه']
  ] },
  { id: 'system', title: 'سیستم', icon: 'system', tabs: [
    ['settings', 'تنظیمات', 'تنظیمات زنده‌ی سرور؛ حالت تعمیر، حداقل نسخه و کلیدهای قابلیت‌ها', 'تنظیم تعمیر نسخه'],
    ['admins', 'مدیران پنل', 'حساب‌ها و نقش‌های ادمین', 'ادمین نقش رمز'],
    ['socket', 'سرویس سوکت', 'اتصال‌ها، صف و مسابقه‌های زنده', 'سوکت صف زنده'],
    ['audit', 'گزارش تغییرها', 'هر کاری که در پنل انجام شده', 'گزارش لاگ تغییر']
  ] }
];
var DESC = {
  dashboard: 'خلاصه‌ی وضعیت بازی: بازیکن‌ها، کاتالوگ، ربات‌ها و کارهای در انتظار.',
  catalog: 'همه‌ی کالاهای بازی با قیمت هر سال. کالا و قیمت تازه از همین‌جا اضافه می‌شود.',
  prices: 'قیمت‌هایی که منتظر تأیید شما هستند؛ تا تأیید نشوند وارد پازل نمی‌شوند.',
  inbox: 'پیشنهادهای ربات برای کالا و قیمت. هر کدام را تأیید یا رد کنید.',
  sources: 'سایت‌هایی که ربات از آن‌ها قیمت جمع می‌کند.',
  puzzles: 'پازل دستی یا خودکار بسازید. هر پازل ۱۶ کالا در ۴ دسته‌ی چهارتایی است.',
  dailypuzzle: 'تم‌های پازل روز و برنامه‌ی روزها.',
  agetracks: 'نمای کلی رده‌های سنی. کلید «رده‌های سنی» در تنظیمات تا وقتی محتوای کودک آماده و تأیید نشده روشن نشود.',
  lessons: 'برای هر آیتم رده‌ی کودک یک کارت درس بنویس: کلمه، داستان کوتاه و (اختیاری) هجاها. فقط درس‌های تأییدشده به بچه‌ها نشان داده می‌شود.',
  levels: 'جاده‌ی لول‌ها: امتیاز (XP) لازم و جایزه‌ی هر لول.',
  tournaments: 'مسابقه‌ی زمان‌دار با ورودی و جایزه‌ی مشخص.',
  sponsors: 'اسپانسرها با بنر و معرفی؛ در صفحه‌ی تورنومنت‌هایی که حمایت می‌کنند نشان داده می‌شوند.',
  taunts: 'جمله‌های آماده‌ای که بازیکن‌ها بدون چت آزاد برای هم می‌فرستند.',
  daily: 'جایزه‌ی هر روز از ورود پشت‌سرهم.',
  shop: 'آیتم‌هایی که بازیکن با سکه یا الماس می‌خرد، و متن راهنمای فروشگاه.',
  landingposts: 'مقاله‌های بلاگ سایت معرفی (مارک‌داون). عنوان و خلاصه‌ی روشن، جمله‌ی اول هر بخش پاسخ مستقیم؛ تغییر نشانی مقاله خودکار ۳۰۱ می‌شود.',
  landingcast: 'شخصیت‌ها و آدم‌های دوزاری برای صفحه‌ی «بازیگران» سایت معرفی.',
  landingfaq: 'پرسش‌ و پاسخ‌های صفحه‌ی اول سایت معرفی (برای گوگل و هوش مصنوعی هم منتشر می‌شود).',
  shortlinks: 'لینک‌های کوتاه دامنه‌ی کوتاه (مثل 2oi.ir): بسازید، خاموش کنید و تعداد کلیک را ببینید.',
  wheel: 'جایزه‌های روی گردونه: نوع، مقدار و شانس هر قطعه.',
  badges: 'نشان‌ها و مدال‌هایی که بازیکن با رسیدن به شرط می‌گیرد.',
  invites: 'کدهای معرف شخصی و کدهای کمپین برای جذب بازیکن.',
  users: 'جست‌وجو و مدیریت بازیکن‌ها: سکه، وضعیت، یادداشت.',
  bots: 'بازیکن‌های ساختگی که وقتی حریف انسانی نیست جای خالی را پر می‌کنند.',
  cities: 'مدیریت شهرها: آمار بازیکن‌ها، فهرست و انتقال آن‌ها، کل‌کل‌های اختصاصی و تنظیمات هر شهر.',
  messages: 'پیام همگانی یا هدفمند برای بازیکن‌ها از چند کانال. تاریخچه‌ی ارسال‌ها هم اینجاست.',
  chatreports: 'گزارش‌هایی که بازیکن‌ها از پیام‌های چت داده‌اند.',
  userreports: 'گزارش‌هایی که بازیکن‌ها از پروفایل یک بازیکن داده‌اند (دلیل و توضیح).',
  ugc: 'کالا و قیمتی که بازیکن‌ها پیشنهاد داده‌اند یا غلط بودنش را گزارش کرده‌اند؛ تأیید یا رد کن.',
  settings: 'عددها و زمان‌های بازی (اقتصاد، ربات، صف…). تغییر بلافاصله اعمال می‌شود.',
  words: 'کلمه‌های توهین‌آمیزی که در متن بازیکن‌ها مسدود می‌شود.',
  bale: 'اتصال ربات بله و تنظیم اعلان‌ها.',
  socket: 'وضعیت زنده‌ی سرویس سوکت (بازی لحظه‌ای).',
  admins: 'حساب مدیران پنل و نقش هر کدام.',
  audit: 'فهرست همه‌ی تغییرهایی که مدیرها داده‌اند، با نام و زمان.'
};
var TAB_HOME = {};
TREE.forEach(function (sec) { sec.tabs.forEach(function (t) { TAB_HOME[t[0]] = sec.id; }); });
`;
export const ADMIN_BOOT_JS = String.raw`
var ROLE_FA = { owner: 'مالک', editor: 'ویرایشگر', support: 'پشتیبان', viewer: 'فقط‌خواندن' };
var TAB_COUNT = { prices: 'prices', inbox: 'inbox', chatreports: 'reports' };
var openSec = {};
function secVisible(sec) { return true; }
function tabVisible(sec, t) { return !(t[0] === 'admins' && !(S.me && S.me.permissions.indexOf('system') >= 0)); }
function tabCount(t) { var k = TAB_COUNT[t[0]]; return k ? (S.counts[k] || 0) : 0; }
function secCount(sec) { return sec.tabs.reduce(function (a, t) { return a + tabCount(t); }, 0); }
function href(secId, key) { return secId === 'dashboard' ? '#/dashboard' : '#/' + secId + '/' + key; }

function drawNav() {
  var nav = clear($('nav'));
  TREE.forEach(function (sec) {
    var tabs = sec.tabs.filter(function (t) { return tabVisible(sec, t); });
    if (!tabs.length) return;
    var active = S.sec === sec.id, c = secCount(sec);
    if (sec.tabs.length === 1) {
      nav.appendChild(h('div', { class: 'nav-sec' + (active ? ' active' : '') }, [h('a', { class: 'nav-head', href: href(sec.id, tabs[0][0]), style: 'text-decoration:none', 'aria-current': active ? 'page' : null, onclick: function () { document.body.classList.remove('nav-open'); } }, [ic(sec.icon), h('span', { text: sec.title })])]));
      return;
    }
    var open = openSec[sec.id] === undefined ? active : openSec[sec.id];
    var box = h('div', { class: 'nav-sec' + (open ? ' open' : '') + (active ? ' active' : '') });
    box.appendChild(h('button', { class: 'nav-head', type: 'button', 'aria-expanded': String(open), onclick: function () { openSec[sec.id] = !open; drawNav(); } }, [ic(sec.icon), h('span', { text: sec.title }), c && !open ? h('span', { class: 'count', text: fa(c) }) : null, h('span', { class: 'chev' }, [ic('chev')])]));
    box.appendChild(h('div', { class: 'nav-sub' }, tabs.map(function (t) {
      var n = tabCount(t);
      return h('a', { href: href(sec.id, t[0]), 'aria-current': active && S.route === t[0] ? 'page' : null, onclick: function () { document.body.classList.remove('nav-open'); } }, [h('span', { text: t[1] }), n ? h('span', { class: 'count', text: fa(n) }) : null]);
    })));
    nav.appendChild(box);
  });
}
function refreshCounts() {
  api('/admin/dashboard').then(function (r) { if (!r.ok) return; S.counts.prices = r.body.catalog.pricesPending; S.counts.inbox = r.body.bot.candidatesPending; drawNav(); });
  api('/admin/chat/reports').then(function (r) { if (!r.ok) return; S.counts.reports = r.body.reports.filter(function (x) { return !x.resolved; }).length; drawNav(); });
}
function findSection(id) { return TREE.filter(function (s) { return s.id === id; })[0]; }
function route() {
  var parts = (location.hash || '#/dashboard').replace(/^#\/?/, '').split('?')[0].split('/');
  var sec = findSection(parts[0]);
  if (!sec && TAB_HOME[parts[0]]) { location.replace(href(TAB_HOME[parts[0]], parts[0])); return; } // an old flat link
  if (!sec) sec = TREE[0];
  var tabs = sec.tabs.filter(function (t) { return tabVisible(sec, t); });
  var tab = tabs.filter(function (t) { return t[0] === parts[1]; })[0] || tabs.filter(function (t) { return t[0] === load('tab.' + sec.id); })[0] || tabs[0];
  if (!tab) { location.replace('#/dashboard'); return; }
  if (sec.tabs.length > 1) store('tab.' + sec.id, tab[0]);
  S.sec = sec.id; S.route = tab[0];
  document.title = tab[1] + ' · مرکز مدیریت دوزاری';
  clear($('crumb')).appendChild(h('span', {}, [sec.id === 'dashboard' ? h('b', { text: 'نمای کلی' }) : [h('span', { text: sec.title }), ' › ', h('b', { text: tab[1] })]]));
  drawNav();
  var root = clear($('view'));
  if (sec.tabs.length > 1) {
    root.appendChild(pageHead(sec.title, null));
    root.appendChild(h('nav', { class: 'tabs', 'aria-label': sec.title }, tabs.map(function (t) {
      var n = tabCount(t);
      return h('a', { href: href(sec.id, t[0]), 'aria-current': t[0] === tab[0] ? 'page' : null }, [h('span', { text: t[1] }), n ? h('span', { class: 'count', text: fa(n) }) : null]);
    })));
  }
  if (S.me && S.me.role === 'viewer') root.appendChild(banner('info', 'حساب تو فقط‌خواندنی است؛ دکمه‌های تغییر از سرور خطای دسترسی می‌گیرند.'));
  var body = h('div', { class: 'view-body' });
  root.appendChild(body);
  if (sec.tabs.length === 1) { /* dashboard draws its own heading */ } else body.appendChild(h('p', { class: 'muted', style: 'margin:-6px 0 16px;font-size:13.5px', text: DESC[tab[0]] || tab[2] }));
  VIEWS[tab[0]](body);
  window.scrollTo(0, 0);
}
function setTheme(t) { S.theme = t; if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme'); store('theme', t); }

/* ---------------- quick jump (Ctrl+K) ---------------- */
function openPalette() {
  if (!S.me || document.querySelector('.palette')) return;
  var input = h('input', { type: 'text', placeholder: 'برو به صفحه یا دنبال بازیکن بگرد (اسم یا شناسه)…', 'aria-label': 'جستجوی سریع', autocomplete: 'off' });
  var list = h('div', { class: 'res', role: 'listbox' }), items = [], sel = 0, timer, seq = 0, close;
  var all = [];
  TREE.forEach(function (sec) { sec.tabs.forEach(function (t) { if (tabVisible(sec, t)) all.push({ g: 'صفحه‌ها', label: t[1], hint: sec.id === 'dashboard' ? '' : sec.title, icon: t[0] in ICON_D ? t[0] : sec.icon, kw: t[1] + ' ' + sec.title + ' ' + (t[3] || ''), run: function () { location.hash = href(sec.id, t[0]); } }); }); });
  all.push({ g: 'کارها', label: 'تغییر تم روشن/تاریک', hint: '', icon: 'sun', kw: 'تم تاریک روشن دارک', run: toggleTheme });
  all.push({ g: 'کارها', label: 'خروج از حساب', hint: '', icon: 'logout', kw: 'خروج', run: logout });
  var users = [];
  function draw() {
    var q = input.value.trim().toLowerCase();
    var base = all.filter(function (a) { return !q || a.kw.toLowerCase().indexOf(q) >= 0; });
    items = users.concat(base).slice(0, 40);
    if (sel >= items.length) sel = 0;
    clear(list);
    if (!items.length) return list.appendChild(h('div', { class: 'empty-state', text: 'چیزی پیدا نشد' }));
    var lastG = null;
    items.forEach(function (it, i) {
      if (it.g !== lastG) { list.appendChild(h('div', { class: 'grp', text: it.g })); lastG = it.g; }
      list.appendChild(h('div', { class: 'it', role: 'option', 'aria-selected': String(i === sel), onmousemove: function () { if (sel !== i) { sel = i; mark(); } }, onclick: function () { go(it); } }, [ic(it.icon), h('span', { text: it.label }), it.hint ? h('small', { text: it.hint }) : null]));
    });
    var cur = list.querySelector('[aria-selected=true]'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }
  function mark() { Array.prototype.forEach.call(list.querySelectorAll('.it'), function (el, i) { el.setAttribute('aria-selected', String(i === sel)); }); }
  function go(it) { close(); it.run(); }
  input.addEventListener('input', function () {
    sel = 0; clearTimeout(timer);
    var q = input.value.trim(), my = ++seq;
    if (q.length < 2) { users = []; return draw(); }
    draw();
    timer = setTimeout(function () {
      api('/admin/users?q=' + encodeURIComponent(q) + '&filter=all&sort=lastSeen&offset=0').then(function (r) {
        if (my !== seq || !r.ok) return;
        users = r.body.users.slice(0, 6).map(function (u) { return { g: 'بازیکن‌ها', label: u.nickname, hint: faNum(u.balance) + ' سکه' + (u.isBanned ? ' · مسدود' : ''), icon: 'users', kw: '', run: function () { location.hash = '#/players/users'; setTimeout(function () { userDrawer(u.id, function () { if (S.route === 'users') route(); }); }, 60); } }; });
        draw();
      });
    }, 250);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); mark(); var c = list.querySelector('[aria-selected=true]'); if (c) c.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); var d = list.querySelector('[aria-selected=true]'); if (d) d.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[sel]) go(items[sel]); }
  });
  var box = h('div', { class: 'palette', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'جستجوی سریع' }, [input, list, h('div', { class: 'hint' }, [h('span', { text: '↑↓ حرکت' }), h('span', { text: '↵ باز کردن' }), h('span', { text: 'Esc بستن' })])]);
  close = overlay('', box);
  draw(); input.focus();
}

/* ---------------- sign-in / session ---------------- */
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
function logout() { sstore('tok', null); S.token = ''; S.me = null; S.counts = {}; while (OVERLAYS.length) closeTop(); showLogin(''); }
function toggleTheme() { var dark = S.theme === 'dark' || (S.theme === null && window.matchMedia('(prefers-color-scheme: dark)').matches); setTheme(dark ? 'light' : 'dark'); }
function enter(token) {
  S.token = token;
  api('/admin/me').then(function (m) {
    if (m.status === 401) { sstore('tok', null); S.token = ''; return showLogin('ورود ناموفق بود.'); }
    if (m.status === 404 || !m.ok) { return showLogin('پنل روی این سرور فعال نیست.'); }
    S.me = m.body;
    api('/admin/meta').then(function (r) {
      if (!r.ok) return showLogin('پنل روی این سرور فعال نیست.');
      S.meta = r.body; sstore('tok', token);
      $('who-name').textContent = S.me.name; $('who-role').textContent = ROLE_FA[S.me.role] || S.me.role;
      $('avatar').textContent = initials(S.me.name);
      $('login').hidden = true; $('app').hidden = false;
      refreshCounts(); route();
    });
  });
}
window.addEventListener('hashchange', route);
document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (S.me) openPalette(); }
  else if (e.key === '/' && S.me && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '') && !OVERLAYS.length) { e.preventDefault(); openPalette(); }
});
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
$('logout').appendChild(ic('logout')); $('menu').appendChild(ic('menu')); $('theme').appendChild(ic('sun'));
$('logout').addEventListener('click', logout);
$('menu').addEventListener('click', function () { document.body.classList.toggle('nav-open'); });
$('theme').addEventListener('click', toggleTheme);
$('quick').addEventListener('click', openPalette);
$('side-search').addEventListener('click', function () { document.body.classList.remove('nav-open'); openPalette(); });
setTheme(load('theme'));
var saved = sload('tok');
if (saved) enter(saved); else showLogin('');
`;
