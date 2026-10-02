export const ADMIN_SHELL_JS = String.raw`
var VIEWS = {};
`;
export const ADMIN_BOOT_JS = String.raw`
var ICON_D = {
  dashboard: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10', catalog: 'M4 6h16v4H4zM4 14h16v4H4z', prices: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M15 9.5H10.5a1.5 1.5 0 0 0 0 3h3a1.5 1.5 0 0 1 0 3H9',
  inbox: 'M3 5h18v14H3zM3 13h5l1 3h6l1-3h5', sources: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1', daily: 'M3 9h18v4H3zM5 13h14v8H5zM12 9v12',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1', users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5c2.5.5 4 2.5 4 5.5',
  socket: 'M4 12h4l3-7 4 14 3-7h2', admins: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4', audit: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3', words: 'M12 3l9 16H3zM12 10v4M12 17v.5', invites: 'M3 8h18v10H3zM3 8l9 6 9-6', badges: 'M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z', shop: 'M4 8h16l-1.5 11h-13zM8 8a4 4 0 0 1 8 0', cities: 'M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6', bale: 'M21 4L3 11l6 2 2 6 3-4 5 3z', messages: 'M3 5h18v14H3zM3 6l9 7 9-7'
};
var NAV = [
  ['main', 'اصلی'], ['dashboard', 'داشبورد'],
  ['main', 'محتوا'], ['catalog', 'کاتالوگ محصولات'], ['prices', 'بازبینی قیمت‌ها', 'prices'], ['inbox', 'صندوق ربات', 'inbox'], ['sources', 'منبع‌های ربات'],
  ['main', 'اقتصاد و بازیکنان'], ['daily', 'جایزه‌ی روزانه'], ['shop', 'فروشگاه'], ['invites', 'کد معرف'], ['badges', 'نشان‌ها و مدال‌ها'], ['users', 'کاربران'], ['cities', 'شهرها'], ['messages', 'مرکز پیام'],
  ['main', 'سیستم'], ['admins', 'مدیران پنل'], ['words', 'فیلتر کلمات'], ['bale', 'ربات بله'], ['settings', 'تنظیمات'], ['socket', 'سرویس سوکت'], ['audit', 'گزارش تغییرها']
];
var TITLES = { dashboard: 'داشبورد', catalog: 'کاتالوگ محصولات', prices: 'بازبینی قیمت‌ها', inbox: 'صندوق پیشنهادهای ربات', sources: 'منبع‌های ربات', daily: 'جایزه‌ی روزانه', users: 'کاربران', settings: 'تنظیمات', socket: 'سرویس سوکت', audit: 'گزارش تغییرها', admins: 'مدیران پنل', words: 'فیلتر کلمات توهین‌آمیز', cities: 'شهرهای بازی', shop: 'فروشگاه و راهنما', invites: 'کدهای معرف', badges: 'نشان‌ها و مدال‌ها', bale: 'ربات بله و اعلان‌ها', messages: 'مرکز پیام' };
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
