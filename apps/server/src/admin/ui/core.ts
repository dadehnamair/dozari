/** Core of the admin SPA: DOM helpers, API client, toasts, modals, icon rendering, router. */
export const ADMIN_CORE_JS = String.raw`
var NS = 'http://www.w3.org/2000/svg';
var S = { token: '', meta: null, route: 'dashboard', counts: {}, theme: null };
function $(id) { return document.getElementById(id); }
function h(tag, attrs, kids) {
  var el = document.createElement(tag);
  attrs = attrs || {};
  Object.keys(attrs).forEach(function (k) {
    var v = attrs[k];
    if (v === null || v === undefined || v === false) return;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  });
  (kids || []).forEach(function (c) { if (c !== null && c !== undefined && c !== false) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
/* Only http(s) links are ever put into href (a stored javascript: URL must not become clickable). */
function safeHref(u) { return /^https?:\/\//i.test(String(u || '')) ? u : '#'; }
var FA = '۰۱۲۳۴۵۶۷۸۹';
function fa(n) { return String(n).replace(/\d/g, function (d) { return FA[d]; }); }
function group(nStr) { return String(nStr).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function faNum(n) { return fa(group(n)); }
function toman(rials) {
  var r = BigInt(rials), q = r / 10n, rem = r % 10n;
  return fa(group(q.toString())) + (rem ? '٫' + fa(rem.toString()) : '') + ' تومان';
}
function ago(ms) {
  if (!ms) return 'هرگز';
  var s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return 'همین الان';
  if (s < 3600) return fa(Math.floor(s / 60)) + ' دقیقه پیش';
  if (s < 86400) return fa(Math.floor(s / 3600)) + ' ساعت پیش';
  return fa(Math.floor(s / 86400)) + ' روز پیش';
}
function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

function api(path, opts) {
  opts = opts || {};
  var headers = { 'x-admin-token': S.token };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  return fetch(path, { method: opts.method || 'GET', headers: headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined })
    .then(function (res) { return res.json().catch(function () { return {}; }).then(function (body) { return { status: res.status, ok: res.ok, body: body }; }); })
    .catch(function () { return { status: 0, ok: false, body: {} }; });
}
function toast(msg, err) {
  var area = $('toasts');
  var t = h('div', { class: 'toast' + (err ? ' err' : ''), text: msg });
  area.appendChild(t);
  setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, err ? 5000 : 2600);
}
var ERR = { unauthorized: 'توکن اشتباه است', invalid_request: 'ورودی نامعتبر است', product_not_found: 'محصول پیدا نشد', slug_taken: 'این شناسه (slug) قبلاً استفاده شده', price_exists: 'همین قیمت قبلاً ثبت شده', approved_price_exists: 'برای این سال قبلاً یک قیمت تأییدشده هست', conflict: 'برای این محصول و سال قبلاً قیمت تأییدشده هست', needs_product: 'یک محصول انتخاب کن یا محصول جدید بساز', duplicate_slug: 'این شناسه قبلاً استفاده شده', already_decided: 'قبلاً تصمیم گرفته شده', insufficient: 'موجودی کافی نیست', source_not_found: 'منبع پیدا نشد', user_not_found: 'کاربر پیدا نشد', invalid_value: 'مقدار خارج از محدوده است', invalid_key: 'تنظیم ناشناخته است' };
function fail(r) { toast(ERR[r.body && r.body.error] || ('خطا (' + r.status + ')'), true); }

function modal(title, body, buttons) {
  var overlay = h('div', { class: 'overlay' });
  function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
  var foot = h('footer', {}, (buttons || []).map(function (b) {
    return h('button', { class: 'btn ' + (b.cls || ''), text: b.label, onclick: function () { var r = b.run ? b.run(close) : undefined; if (!b.keepOpen && r !== false) close(); } });
  }));
  var box = h('div', { class: 'modal', role: 'dialog', 'aria-label': title }, [
    h('header', {}, [h('h3', { text: title }), h('button', { class: 'btn ghost sm', text: 'بستن', onclick: close })]),
    h('div', { class: 'body' }, [body]),
    buttons && buttons.length ? foot : null
  ]);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  return close;
}

function svgEl(tag, attrs) { var el = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); }); return el; }
function iconSvg(key, px) {
  var icons = S.meta && S.meta.icons ? S.meta.icons : {};
  var def = icons[key];
  var svg = svgEl('svg', { viewBox: '-4 -4 72 72', width: px || 40, height: px || 40 });
  if (!def) return svg;
  var g = svgEl('g', { stroke: '#3A2418', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  def.p.forEach(function (p) {
    var d = p[0], f = p[1], a = p[2], b = p[3];
    if (f === 'L') g.appendChild(svgEl('path', { d: d, fill: 'none', stroke: b || '#3A2418', 'stroke-width': a }));
    else if (f === 'H') g.appendChild(svgEl('path', { d: d, fill: 'none', stroke: '#fff', 'stroke-width': 2.4 }));
    else g.appendChild(svgEl('path', { d: d, fill: f, stroke: a === 'N' ? 'none' : '#3A2418', 'stroke-width': 2.4 }));
  });
  (def.t || []).forEach(function (t) {
    var tx = svgEl('text', { x: t[0], y: t[1], 'text-anchor': 'middle', 'font-size': t[2], fill: t[4], stroke: 'none', 'font-weight': 700 });
    tx.textContent = t[3];
    g.appendChild(tx);
  });
  svg.appendChild(g);
  return svg;
}
function iconTile(key) {
  if (!key) return h('div', { class: 'icon-tile empty', text: '＋', title: 'بدون آیکن' });
  return h('div', { class: 'icon-tile' }, [iconSvg(key, 40)]);
}
function iconPicker(current, onPick) {
  var keys = Object.keys((S.meta && S.meta.icons) || {});
  var grid = h('div', { class: 'icon-pick' });
  var q = h('input', { type: 'search', placeholder: 'جستجوی آیکن (انگلیسی)…' });
  function draw() {
    clear(grid);
    var term = q.value.trim().toLowerCase();
    keys.filter(function (k) { return !term || k.toLowerCase().indexOf(term) >= 0; }).forEach(function (k) {
      grid.appendChild(h('button', { type: 'button', 'aria-pressed': String(k === current), title: k, onclick: function () { current = k; onPick(k); draw(); } }, [iconSvg(k, 40), h('span', { class: 'ltr', text: k })]));
    });
  }
  q.addEventListener('input', draw);
  draw();
  return h('div', { style: 'display:flex;flex-direction:column;gap:8px' }, [q, grid]);
}
function badge(text, cls) { return h('span', { class: 'badge ' + (cls || 'b-mute'), text: text }); }
function field(label, input, hint) { return h('label', { class: 'f' }, [label, input, hint ? h('span', { class: 'h', text: hint, style: 'font-size:12px' }) : null]); }
function card(title, sub, kids) { return h('section', { class: 'card' }, [title ? h('h2', { text: title }) : null, sub ? h('div', { class: 'sub', text: sub }) : null].concat(kids || [])); }
function empty(text) { return h('div', { class: 'empty-state', text: text }); }
function select(options, value) { var s = h('select'); options.forEach(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; s.appendChild(h('option', { value: v, text: l })); }); s.value = value === undefined || value === null ? options[0] && (Array.isArray(options[0]) ? options[0][0] : options[0]) : value; return s; }

var CAT_FA = { car: 'خودرو', food: 'خوراکی', snack: 'تنقلات', drink: 'نوشیدنی', digital: 'دیجیتال', electronics: 'لوازم برقی', housing: 'مسکن', transport: 'حمل‌ونقل', education: 'آموزش', entertainment: 'سرگرمی', clothing: 'پوشاک', hygiene: 'بهداشتی', service: 'خدمات', other: 'سایر' };
var SRC_FA = { archive_newspaper: 'آرشیو روزنامه', official_list: 'لیست رسمی', receipt_photo: 'عکس فاکتور', website: 'وب‌سایت', user_memory: 'خاطره‌ی کاربر', other: 'سایر' };
function catOptions() { return ((S.meta && S.meta.categories) || []).map(function (c) { return [c, CAT_FA[c] || c]; }); }
`;
