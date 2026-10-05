/** Core of the admin SPA: DOM helpers, API client, toasts, modals, icon rendering, router. */
export const ADMIN_CORE_JS = String.raw`
var NS = 'http://www.w3.org/2000/svg';
var S = { token: '', me: null, meta: null, route: 'dashboard', counts: {}, theme: null };
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
  // Children may be nested arrays (e.g. a list built with .map next to other nodes): flatten them.
  (function add(list) {
    list.forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) return add(c);
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
  })(kids || []);
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
/* The sign-in token lives only as long as the tab (sessionStorage), never in localStorage. */
function sstore(k, v) { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { /* private mode */ } }
function sload(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }

function api(path, opts) {
  opts = opts || {};
  var headers = { 'x-admin-token': S.token };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  return fetch(path, { method: opts.method || 'GET', headers: headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined })
    .then(function (res) { return res.json().catch(function () { return {}; }).then(function (body) { if (res.status === 401 && S.token && path !== '/admin/login') { sstore('tok', null); S.token = ''; showLogin('نشست تمام شد؛ دوباره وارد شو.'); } return { status: res.status, ok: res.ok, body: body }; }); })
    .catch(function () { return { status: 0, ok: false, body: {} }; });
}
function toast(msg, err) {
  var area = $('toasts');
  var t = h('div', { class: 'toast' + (err ? ' err' : ''), text: msg });
  area.appendChild(t);
  setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, err ? 5000 : 2600);
}
var ERR = { invalid_code: 'کد نامعتبر است: ۴ تا ۱۲ حرف/عدد، فقط از «۲۳۴۵۶۷۸۹ و ABCDEFGHJKMNPQRSTUVWXYZ» (بدون ۰ ۱ O I L)', invalid_request: 'ورودی نادرست است؛ کد، نام کمپین و تعداد استفاده را بررسی کن', unauthorized: 'توکن اشتباه است', forbidden: 'نقش تو اجازه‌ی این کار را ندارد', rate_limited: 'تلاش‌های زیاد؛ کمی بعد دوباره امتحان کن', invalid_credentials: 'نام کاربری یا رمز درست نیست', account_locked: 'حساب برای چند دقیقه قفل شد', duplicate: 'این نام کاربری قبلاً هست', invalid_username: 'نام کاربری: ۳ تا ۳۰ حرف انگلیسی کوچک، عدد، نقطه یا خط تیره', weak_password: 'رمز ضعیف است (حداقل ۱۰ نویسه، بدون نام کاربری، متنوع)', last_owner: 'آخرین مالک را نمی‌شود برداشت یا غیرفعال کرد', not_found: 'پیدا نشد', invalid_request: 'ورودی نامعتبر است', product_not_found: 'محصول پیدا نشد', slug_taken: 'این شناسه (slug) قبلاً استفاده شده', price_exists: 'همین قیمت قبلاً ثبت شده', approved_price_exists: 'برای این سال قبلاً یک قیمت تأییدشده هست', conflict: 'برای این محصول و سال قبلاً قیمت تأییدشده هست', needs_product: 'یک محصول انتخاب کن یا محصول جدید بساز', duplicate_slug: 'این شناسه قبلاً استفاده شده', already_decided: 'قبلاً تصمیم گرفته شده', insufficient: 'موجودی کافی نیست', source_not_found: 'منبع پیدا نشد', user_not_found: 'کاربر پیدا نشد', invalid_value: 'مقدار خارج از محدوده است', invalid_key: 'تنظیم ناشناخته است' };
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
  var groups = (S.meta && S.meta.iconGroups) || [], have = (S.meta && S.meta.icons) || {};
  var faOf = {}, groupOf = {};
  groups.forEach(function (g) { g.icons.forEach(function (i) { faOf[i.key] = i.fa; groupOf[i.key] = g.id; }); });
  var keys = Object.keys(have), cat = 'all';
  var grid = h('div', { class: 'icon-pick' });
  var chips = h('div', { class: 'chips', style: 'display:flex;flex-wrap:wrap;gap:6px' });
  var q = h('input', { type: 'search', placeholder: 'جستجوی آیکن (فارسی یا انگلیسی)…' });
  function drawChips() {
    clear(chips);
    [{ id: 'all', titleFa: 'همه', n: keys.length }].concat(groups.map(function (g) { return { id: g.id, titleFa: g.titleFa, n: g.icons.length }; })).forEach(function (g) {
      chips.appendChild(h('button', { type: 'button', class: 'chip', 'aria-pressed': String(g.id === cat), text: g.titleFa + ' · ' + faNum(g.n), onclick: function () { cat = g.id; drawChips(); draw(); } }));
    });
  }
  function draw() {
    clear(grid);
    var term = q.value.trim().toLowerCase();
    keys.filter(function (k) {
      if (cat !== 'all' && groupOf[k] !== cat) return false;
      return !term || k.toLowerCase().indexOf(term) >= 0 || (faOf[k] || '').indexOf(term) >= 0;
    }).forEach(function (k) {
      grid.appendChild(h('button', { type: 'button', 'aria-pressed': String(k === current), title: k, onclick: function () { current = k; onPick(k); draw(); } }, [iconSvg(k, 40), h('span', { text: faOf[k] || k }), h('span', { class: 'ltr', text: k, style: 'opacity:.6' })]));
    });
    if (!grid.firstChild) grid.appendChild(h('div', { class: 'empty-state', text: 'آیکنی پیدا نشد' }));
  }
  q.addEventListener('input', draw);
  drawChips(); draw();
  return h('div', { style: 'display:flex;flex-direction:column;gap:8px' }, [q, chips, grid]);
}
function badge(text, cls) { return h('span', { class: 'badge ' + (cls || 'b-mute'), text: text }); }
function field(label, input, hint) { return h('label', { class: 'f' }, [label, input, hint ? h('span', { class: 'h', text: hint, style: 'font-size:12px' }) : null]); }
function card(title, sub, kids) { return h('section', { class: 'card' }, [title ? h('h2', { text: title }) : null, sub ? h('div', { class: 'sub', text: sub }) : null].concat(kids || [])); }
/* A card with a «＋ add» button; the form opens in a modal. fields: [[label, input, hint?]] or ready-made nodes; save() resolves true to close it. */
function formModal(title, fields, save) {
  var busy = false;
  var body = h('div', { class: 'form-grid' }, fields.map(function (f) { return Array.isArray(f) ? field(f[0], f[1], f[2]) : f; }));
  modal(title, body, [{ label: 'انصراف' }, { label: 'ذخیره', cls: 'primary', keepOpen: true, run: function (close) {
    if (busy) return; busy = true;
    Promise.resolve(save()).then(function (ok) { busy = false; if (ok) close(); });
  } }]);
  var first = body.querySelector('input,select,textarea'); if (first) first.focus();
}
function addCard(title, sub, btnLabel, fields, save) {
  function open() { formModal(title, fields, save); }
  return h('section', { class: 'card add-card' }, [h('div', { class: 'add-head' }, [h('div', {}, [h('h2', { text: title }), sub ? h('div', { class: 'sub', text: sub }) : null]), h('button', { class: 'btn primary', text: '＋ ' + btnLabel, onclick: open })])]);
}
function empty(text) { return h('div', { class: 'empty-state', text: text }); }
function select(options, value) { var s = h('select'); options.forEach(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; s.appendChild(h('option', { value: v, text: l })); }); s.value = value === undefined || value === null ? options[0] && (Array.isArray(options[0]) ? options[0][0] : options[0]) : value; return s; }

var CAT_FA = { car: 'خودرو', food: 'خوراکی', snack: 'تنقلات', drink: 'نوشیدنی', digital: 'دیجیتال', electronics: 'لوازم برقی', housing: 'مسکن', transport: 'حمل‌ونقل', education: 'آموزش', entertainment: 'سرگرمی', clothing: 'پوشاک', hygiene: 'بهداشتی', service: 'خدمات', other: 'سایر' };
var SRC_FA = { archive_newspaper: 'آرشیو روزنامه', official_list: 'لیست رسمی', receipt_photo: 'عکس فاکتور', website: 'وب‌سایت', user_memory: 'خاطره‌ی کاربر', other: 'سایر' };
function catOptions() { return ((S.meta && S.meta.categories) || []).map(function (c) { return [c, CAT_FA[c] || c]; }); }
`;
