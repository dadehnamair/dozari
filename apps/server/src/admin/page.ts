/**
 * Single-file catalog review page served at GET /admin (interim tool, see routes.ts).
 * Kept as a string so it needs no build/copy step. Fully self-contained: no external fonts,
 * scripts or requests. All data is inserted with textContent / DOM APIs, never innerHTML.
 */
export const ADMIN_PAGE_HTML = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>پنل ادمین دوزاری</title>
<style>
  :root { color-scheme: light dark; --bg:#f6f6f4; --card:#fff; --ink:#1c1c1a; --muted:#6b6b66; --line:#e2e2dc;
    --ok:#1a7f4b; --okbg:#e3f4ea; --warn:#a15c00; --warnbg:#fff1d6; --bad:#b3261e; --badbg:#fde7e5; --pend:#3a4a8a; --pendbg:#e6e9f8; --accent:#2b59c3; }
  @media (prefers-color-scheme: dark) { :root { --bg:#151514; --card:#1f1f1d; --ink:#ecece8; --muted:#a3a39c; --line:#33332f;
    --ok:#6fd3a0; --okbg:#173325; --warn:#f0b35a; --warnbg:#3a2a10; --bad:#f19a94; --badbg:#3d1c1a; --pend:#a9b6f0; --pendbg:#212745; --accent:#8fb0ff; } }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.6 Tahoma, "Segoe UI", system-ui, sans-serif; }
  header { position:sticky; top:0; background:var(--card); border-bottom:1px solid var(--line); padding:12px 16px; z-index:2; }
  h1 { font-size:18px; margin:0 0 8px; }
  .bar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  input, button { font:inherit; color:inherit; }
  input[type=text], input[type=password], input[type=search] { background:var(--bg); border:1px solid var(--line); border-radius:8px; padding:6px 10px; min-width:0; }
  button { border:1px solid var(--line); background:var(--card); border-radius:8px; padding:5px 12px; cursor:pointer; }
  button:hover { border-color:var(--accent); }
  button.tab[aria-pressed=true] { background:var(--accent); color:#fff; border-color:var(--accent); }
  main { max-width:960px; margin:0 auto; padding:16px; }
  .msg { padding:10px 12px; border-radius:8px; background:var(--badbg); color:var(--bad); margin-bottom:12px; }
  .msg.info { background:var(--pendbg); color:var(--pend); }
  .product { background:var(--card); border:1px solid var(--line); border-radius:12px; margin-bottom:14px; overflow:hidden; }
  .product h2 { margin:0; font-size:16px; padding:10px 14px; border-bottom:1px solid var(--line); }
  .product h2 small { color:var(--muted); font-weight:normal; margin-inline-start:8px; }
  .row { display:grid; grid-template-columns: 90px 1fr auto; gap:6px 12px; padding:10px 14px; border-bottom:1px solid var(--line); align-items:start; }
  .row:last-child { border-bottom:0; }
  .year { font-weight:bold; }
  .price { font-weight:bold; }
  .meta { color:var(--muted); font-size:13px; }
  .badge { display:inline-block; border-radius:999px; padding:0 8px; font-size:12px; margin-inline-start:6px; }
  .s-approved { background:var(--okbg); color:var(--ok); } .s-pending { background:var(--pendbg); color:var(--pend); } .s-rejected { background:var(--badbg); color:var(--bad); }
  .warn { background:var(--warnbg); color:var(--warn); border-radius:6px; padding:2px 8px; font-size:13px; margin-top:4px; display:inline-block; }
  .actions { display:flex; gap:6px; flex-wrap:wrap; }
  .actions .approve { color:var(--ok); } .actions .reject { color:var(--bad); }
  .panel { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px; margin-bottom:14px; }
  .panel h2 { margin:0 0 6px; font-size:16px; }
  .steps { display:grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap:8px; margin:12px 0; }
  .steps label { display:flex; flex-direction:column; gap:2px; font-size:13px; color:var(--muted); }
  .steps input { background:var(--bg); border:1px solid var(--line); border-radius:8px; padding:6px 10px; width:100%; }
  @media (max-width:600px) { .row { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<header>
  <h1>پنل ادمین دوزاری</h1>
  <div class="bar">
    <input id="token" type="password" placeholder="توکن ادمین" autocomplete="off" size="18">
    <button id="login">ورود</button>
    <span id="sections" class="bar" hidden></span>
    <span id="tabs" class="bar" hidden></span>
    <input id="q" type="search" placeholder="جستجوی محصول…" hidden>
  </div>
</header>
<main id="main"><div class="msg info">توکن ادمین (مقدار ADMIN_TOKEN در فایل .env) را وارد کن.</div></main>
<script>
(function () {
  var STATUS_LABEL = { pending: 'در انتظار', approved: 'تأییدشده', rejected: 'ردشده' };
  var SOURCE_LABEL = { archive_newspaper: 'آرشیو روزنامه', official_list: 'فهرست رسمی', receipt_photo: 'عکس فاکتور', website: 'وب‌سایت', user_memory: 'خاطره', other: 'سایر' };
  var state = { token: '', products: [], filter: 'pending', q: '', section: 'prices' };
  var $ = function (id) { return document.getElementById(id); };
  var fa = new Intl.NumberFormat('fa-IR', { useGrouping: false });
  var faGroup = new Intl.NumberFormat('fa-IR');

  function store(k, v) { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }

  // rials -> toman text without floats: 1 toman = 10 rials, remainder shown as a decimal digit.
  function tomanText(rialsStr) {
    var r = BigInt(rialsStr), t = r / 10n, rem = r % 10n;
    var s = faGroup.format(t);
    if (rem !== 0n) s += '٫' + fa.format(Number(rem));
    return s + ' تومان';
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function showMsg(text, info) {
    var m = el('div', 'msg' + (info ? ' info' : ''), text);
    $('main').replaceChildren(m);
  }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'x-admin-token': state.token, 'content-type': 'application/json' }, opts.headers || {});
    return fetch(path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) { return { status: res.status, body: body }; });
    });
  }

  function setSection(name) {
    state.section = name;
    Array.prototype.forEach.call($('sections').children, function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-s') === name)); });
    var prices = name === 'prices';
    $('tabs').hidden = !prices; $('q').hidden = !prices;
    if (prices) render(); else if (name === 'daily') loadDaily();
  }

  function buildSections() {
    var bar = $('sections');
    [['prices', 'قیمت‌ها'], ['daily', 'جایزه روزانه']].forEach(function (t) {
      var b = el('button', 'tab', t[1]);
      b.setAttribute('data-s', t[0]);
      b.setAttribute('aria-pressed', String(t[0] === state.section));
      b.addEventListener('click', function () { setSection(t[0]); });
      bar.appendChild(b);
    });
  }

  // ---- daily reward: coins for day 1, 2, 3 ... of a streak; the last amount repeats afterwards ----
  function loadDaily() {
    api('/admin/daily-reward').then(function (r) {
      if (r.status === 401) { showMsg('توکن اشتباه است.'); return; }
      if (r.status === 404) { showMsg('جایزه روزانه روی این سرور فعال نیست.'); return; }
      if (r.status !== 200) { showMsg('خطا در دریافت اطلاعات (' + r.status + ').'); return; }
      renderDaily(r.body.steps.slice());
    }).catch(function () { showMsg('اتصال به سرور برقرار نشد.'); });
  }

  function renderDaily(steps) {
    var panel = el('section', 'panel');
    panel.appendChild(el('h2', '', 'جایزه روزانه'));
    panel.appendChild(el('div', 'meta', 'هر ۲۴ ساعت یک بار قابل دریافت است. اگر کاربر پشت‌سر‌هم بگیرد روز بعد مبلغ بالاتر می‌گیرد؛ اگر یک روز کامل فاصله بیفتد دوباره از روز ۱ شروع می‌شود. بعد از آخرین روز، همان مبلغ آخر تکرار می‌شود.'));
    var grid = el('div', 'steps');
    var inputs = [];
    steps.forEach(function (coins, i) {
      var label = el('label', '', 'روز ' + (i + 1));
      var input = document.createElement('input');
      input.type = 'number'; input.min = '1'; input.max = '10000'; input.step = '1'; input.value = String(coins);
      inputs.push(input);
      label.appendChild(input);
      grid.appendChild(label);
    });
    panel.appendChild(grid);
    var actions = el('div', 'actions');
    var add = actionButton('', 'افزودن روز', function () { steps = read(); steps.push(steps.length ? steps[steps.length - 1] : 10); renderDaily(steps); });
    var drop = actionButton('reject', 'حذف آخرین روز', function () { steps = read(); if (steps.length > 1) steps.pop(); renderDaily(steps); });
    var save = actionButton('approve', 'ذخیره', function () {
      var values = read();
      api('/admin/daily-reward', { method: 'PUT', body: JSON.stringify({ steps: values }) }).then(function (r) {
        if (r.status !== 200) { showMsg('ذخیره نشد: مبلغ‌ها باید عدد صحیح بین ۱ و ۱۰٬۰۰۰ باشند.'); return; }
        renderDaily(r.body.steps.slice());
        $('main').insertBefore(el('div', 'msg info', 'ذخیره شد.'), $('main').firstChild);
      }).catch(function () { showMsg('اتصال به سرور برقرار نشد.'); });
    });
    [add, drop, save].forEach(function (b) { actions.appendChild(b); });
    panel.appendChild(actions);
    $('main').replaceChildren(panel);
    function read() { return inputs.map(function (i) { return Number(i.value); }); }
  }

  function refresh() {
    return api('/admin/catalog').then(function (r) {
      if (r.status === 401) { store('tok', null); showMsg('توکن اشتباه است.'); $('tabs').hidden = true; $('q').hidden = true; $('sections').hidden = true; return; }
      if (r.status !== 200) { showMsg('خطا در دریافت اطلاعات (' + r.status + ').'); return; }
      state.products = r.body.products;
      $('sections').hidden = false;
      setSection(state.section);
    }).catch(function () { showMsg('اتصال به سرور برقرار نشد.'); });
  }

  // Sanity flags from the price-catalog skill: >30% drop or >5x jump vs the previous non-rejected point.
  function warningFor(prices, i) {
    var cur = prices[i], prev = null;
    for (var k = i - 1; k >= 0; k--) { if (prices[k].status !== 'rejected') { prev = prices[k]; break; } }
    if (!prev) return '';
    var c = BigInt(cur.priceRials), p = BigInt(prev.priceRials);
    if (c * 10n < p * 7n) return 'افت بیش از ۳۰٪ نسبت به ' + fa.format(prev.year) + ' — احتمال اشتباه ریال/تومان';
    if (c > p * 5n) return 'جهش بیش از ۵ برابر نسبت به ' + fa.format(prev.year) + ' — بررسی شود';
    return '';
  }

  function setStatus(price, status) {
    api('/admin/prices/' + price.id, { method: 'PATCH', body: JSON.stringify({ status: status }) }).then(function (r) {
      if (r.status === 409) { alert('برای همین سال و ماه قیمت تأییدشدهٔ دیگری وجود دارد. اول آن را رد یا در انتظار کن.'); return; }
      if (r.status !== 200) { alert('ثبت نشد (' + r.status + ').'); return; }
      price.status = status;
      render();
    });
  }

  function actionButton(cls, label, onClick) {
    var b = el('button', cls, label);
    b.addEventListener('click', onClick);
    return b;
  }

  function priceRow(prices, i) {
    var p = prices[i];
    var row = el('div', 'row');
    row.appendChild(el('div', 'year', fa.format(p.year) + (p.month ? '/' + fa.format(p.month) : '')));

    var mid = el('div');
    var line = el('div');
    line.appendChild(el('span', 'price', tomanText(p.priceRials)));
    line.appendChild(el('span', 'badge s-' + p.status, STATUS_LABEL[p.status]));
    mid.appendChild(line);
    mid.appendChild(el('div', 'meta', (SOURCE_LABEL[p.sourceType] || p.sourceType) + ' · اطمینان ' + fa.format(p.confidence) + (p.sourceNote ? ' · ' + p.sourceNote : '')));
    if (p.sourceUrl && /^https?:\\/\\//.test(p.sourceUrl)) {
      var a = el('a', 'meta', p.sourceUrl); a.href = p.sourceUrl; a.target = '_blank'; a.rel = 'noopener noreferrer';
      mid.appendChild(a);
    }
    var w = warningFor(prices, i);
    if (w) mid.appendChild(el('div', 'warn', w));
    row.appendChild(mid);

    var actions = el('div', 'actions');
    if (p.status !== 'approved') actions.appendChild(actionButton('approve', 'تأیید', function () { setStatus(p, 'approved'); }));
    if (p.status !== 'rejected') actions.appendChild(actionButton('reject', 'رد', function () { setStatus(p, 'rejected'); }));
    if (p.status !== 'pending') actions.appendChild(actionButton('', 'در انتظار', function () { setStatus(p, 'pending'); }));
    row.appendChild(actions);
    return row;
  }

  function render() {
    var main = $('main'), count = 0, q = state.q.trim().toLowerCase();
    var frag = document.createDocumentFragment();
    state.products.forEach(function (prod) {
      if (q && prod.nameFa.toLowerCase().indexOf(q) === -1 && prod.slug.indexOf(q) === -1) return;
      var idx = [];
      prod.prices.forEach(function (p, i) { if (state.filter === 'all' || p.status === state.filter) idx.push(i); });
      if (idx.length === 0) return;
      var card = el('section', 'product');
      var h = el('h2', '', prod.nameFa);
      h.appendChild(el('small', '', (prod.unitFa || '') + ' · ' + prod.slug));
      card.appendChild(h);
      idx.forEach(function (i) { card.appendChild(priceRow(prod.prices, i)); count++; });
      frag.appendChild(card);
    });
    if (count === 0) { showMsg('موردی برای نمایش نیست.', true); return; }
    main.replaceChildren(frag);
  }

  function buildTabs() {
    var tabs = $('tabs');
    [['pending', 'در انتظار'], ['approved', 'تأییدشده'], ['rejected', 'ردشده'], ['all', 'همه']].forEach(function (t) {
      var b = el('button', 'tab', t[1]);
      b.setAttribute('aria-pressed', String(t[0] === state.filter));
      b.addEventListener('click', function () {
        state.filter = t[0];
        Array.prototype.forEach.call(tabs.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        render();
      });
      tabs.appendChild(b);
    });
  }

  $('login').addEventListener('click', function () {
    state.token = $('token').value.trim();
    if (!state.token) return;
    store('tok', state.token);
    refresh();
  });
  $('token').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('login').click(); });
  $('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });

  buildTabs();
  buildSections();
  var saved = load('tok');
  if (saved) { state.token = saved; $('token').value = saved; refresh(); }
})();
</script>
</body>
</html>
`;
