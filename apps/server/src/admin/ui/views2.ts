export const ADMIN_VIEWS2_JS = String.raw`
/* ---------------- bot inbox ---------------- */
function autoSlug() { return 'item-' + Math.random().toString(36).slice(2, 10); }
VIEWS.inbox = function (root) {
  var status = 'pending', tabs = h('div', { style: 'display:flex;gap:6px' }), list = h('div');
  var runBtn = h('button', { class: 'btn', text: 'اجرای ربات الان', onclick: function () {
    runBtn.disabled = true; runBtn.textContent = 'در حال اجرا…';
    api('/admin/bot/run-due', { method: 'POST', body: {} }).then(function (r) {
      runBtn.disabled = false; runBtn.textContent = 'اجرای ربات الان';
      if (!r.ok) return fail(r);
      var n = r.body.runs.reduce(function (a, x) { return a + x.added; }, 0);
      toast(r.body.runs.length ? fa(n) + ' پیشنهاد تازه از ' + fa(r.body.runs.length) + ' منبع' : 'منبعی سررسید نشده بود'); load2();
    });
  } });
  root.appendChild(h('div', { class: 'toolbar' }, [tabs, h('span', { style: 'flex:1' }), h('a', { class: 'btn', href: '#/sources', text: 'منبع‌ها' }), runBtn]));
  root.appendChild(list);
  function load2() {
    clear(tabs);
    [['pending', 'در انتظار'], ['approved', 'تأییدشده'], ['rejected', 'ردشده']].forEach(function (t) { tabs.appendChild(h('button', { class: 'chip', 'aria-pressed': String(status === t[0]), text: t[1], onclick: function () { status = t[0]; load2(); } })); });
    api('/admin/bot/candidates?status=' + status).then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('ربات روی این سرور فعال نیست (دیتابیس لازم است)'));
      if (!r.ok) return fail(r);
      if (!r.body.candidates.length) return list.appendChild(empty(status === 'pending' ? 'پیشنهادی برای بررسی نیست. ربات را اجرا کن یا منبع اضافه کن.' : 'موردی نیست'));
      r.body.candidates.forEach(function (c) { list.appendChild(candidateCard(c, load2)); });
      refreshCounts();
    });
  }
  load2();
};
function candidateCard(c, reload) {
  var known = !!c.productId;
  var cat = select(catOptions(), c.categoryGuess || 'food'), slug = h('input', { type: 'text', dir: 'ltr', value: autoSlug() }), name = h('input', { type: 'text', value: c.productNameFa });
  var icon = null, iconBox = h('div'), showPick = false;
  var newBox = h('div', { class: 'form-grid' }, [field('نام محصول', name), field('دسته', cat), field('شناسه (slug)', slug)]);
  var pickBtn = h('button', { class: 'btn sm', text: 'انتخاب آیکن', onclick: function () {
    var close = modal('انتخاب آیکن', iconPicker(icon, function (k) { icon = k; clear(iconBox); iconBox.appendChild(iconTile(k)); close(); }), []);
  } });
  function approve() {
    var body = known ? {} : { create: { slug: slug.value.trim(), nameFa: name.value.trim(), category: cat.value, unitFa: c.unitFa, iconKey: icon } };
    api('/admin/bot/candidates/' + c.id + '/approve', { method: 'POST', body: body }).then(function (r) { if (!r.ok) return fail(r); toast('تأیید شد و قیمت به کاتالوگ رفت'); reload(); });
  }
  function reject() { api('/admin/bot/candidates/' + c.id + '/reject', { method: 'POST', body: {} }).then(function (r) { if (!r.ok) return fail(r); toast('رد شد'); reload(); }); }
  return h('div', { class: 'cand' }, [
    h('div', { class: 'head' }, [h('span', { class: 'name', text: c.productNameFa }), c.unitFa ? badge(c.unitFa) : null, known ? badge('در کاتالوگ هست', 'b-ok') : badge('محصول جدید', 'b-warn'), h('span', { style: 'flex:1' }),
      h('span', { class: 'price num', text: toman(c.priceRials) }), badge('سال ' + fa(c.year) + (c.month ? '/' + fa(c.month) : ''), 'b-info')]),
    h('div', { class: 'sub', style: 'color:var(--muted);font-size:13px' }, ['منبع: ', h('b', { text: c.sourceName || 'نامشخص' }), ' · ', h('a', { href: c.sourceUrl, target: '_blank', rel: 'noopener noreferrer', text: 'باز کردن صفحه' }), ' · ' + ago(c.createdAt)]),
    c.excerpt ? h('div', { class: 'quote', text: c.excerpt }) : null,
    c.status === 'pending' ? h('div', { style: 'display:flex;flex-direction:column;gap:10px' }, [
      known ? null : h('div', {}, [newBox, h('div', { style: 'display:flex;gap:8px;align-items:center;margin-top:8px' }, [iconBox, pickBtn])]),
      h('div', { style: 'display:flex;gap:8px' }, [h('button', { class: 'btn ok', text: '✓ تأیید و ثبت قیمت', onclick: approve }), h('button', { class: 'btn bad', text: '✕ رد', onclick: reject })])
    ]) : badge(c.status === 'approved' ? 'تأییدشده' : 'ردشده', c.status === 'approved' ? 'b-ok' : 'b-bad')
  ]);
}

/* ---------------- bot sources ---------------- */
var ADAPTER_HELP = {
  html_table: { label: 'جدول HTML', opts: [['name_col', 'ستون نام (از ۰)', '0'], ['price_col', 'ستون قیمت (از ۰)', '1'], ['year_col', 'ستون سال (خالی = سال پیش‌فرض)', ''], ['unit_col', 'ستون واحد (اختیاری)', ''], ['default_year', 'سال پیش‌فرض اگر ستون سال نیست', ''], ['skip_rows', 'ردیف‌های سرتیتر', '1'], ['table_index', 'شماره‌ی جدول در صفحه', '0'], ['price_multiplier', 'ضریب تبدیل به ریال (۱۰ اگر صفحه تومان می‌دهد)', '1'], ['category', 'دسته‌ی حدسی', '']] },
  csv: { label: 'فایل CSV', opts: [['name_col', 'ستون نام', '0'], ['price_col', 'ستون قیمت', '1'], ['year_col', 'ستون سال', ''], ['unit_col', 'ستون واحد', ''], ['default_year', 'سال پیش‌فرض', ''], ['delimiter', 'جداکننده', ','], ['skip_rows', 'ردیف‌های سرتیتر', '1'], ['price_multiplier', 'ضریب تبدیل به ریال', '1'], ['category', 'دسته‌ی حدسی', '']] },
  text_lines: { label: 'خط‌به‌خط متن (عبارت منظم)', opts: [['pattern', 'عبارت منظم با گروه‌های name, price, year', '^(?<name>.+?) (?<year>[۰-۹]{4}): (?<price>[۰-۹٬]+) ریال'], ['price_multiplier', 'ضریب تبدیل به ریال', '1'], ['default_year', 'سال پیش‌فرض', ''], ['category', 'دسته‌ی حدسی', '']] }
};
VIEWS.sources = function (root) {
  var list = h('div');
  root.appendChild(h('div', { class: 'toolbar' }, [h('a', { class: 'btn', href: '#/inbox', text: '← صندوق پیشنهادها' }), h('span', { style: 'flex:1' }), h('button', { class: 'btn primary', text: '＋ منبع جدید', onclick: function () { sourceForm(null, load3); } })]));
  root.appendChild(list);
  var runs = h('div');
  root.appendChild(card('اجراهای اخیر ربات', 'هر اجرا چند مورد پیدا کرد و چندتا تازه بود', [runs]));
  function load3() {
    api('/admin/bot/sources').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('ربات روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      if (!r.body.sources.length) list.appendChild(empty('هنوز منبعی نیست. یک منبع با آدرس صفحه‌ی قیمت‌ها و ستون‌ها تعریف کن.'));
      r.body.sources.forEach(function (s) {
        list.appendChild(h('div', { class: 'cand' }, [
          h('div', { class: 'head' }, [h('span', { class: 'name', text: s.name }), badge(ADAPTER_HELP[s.adapter].label, 'b-info'), badge(s.enabled ? 'روشن' : 'خاموش', s.enabled ? 'b-ok' : 'b-mute'), badge('هر ' + fa(s.everyHours) + ' ساعت'), h('span', { style: 'flex:1' }), h('span', { class: 'sub', style: 'color:var(--muted);font-size:13px', text: 'آخرین اجرا: ' + ago(s.lastRunAt) })]),
          h('div', { class: 'ltr', style: 'color:var(--muted);font-size:13px;word-break:break-all' }, [s.url]),
          h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, [
            h('button', { class: 'btn sm', text: 'اجرا', onclick: function () { api('/admin/bot/sources/' + s.id + '/run', { method: 'POST', body: {} }).then(function (x) { if (!x.ok) return fail(x); toast(x.body.status === 'ok' ? fa(x.body.found) + ' مورد پیدا شد، ' + fa(x.body.added) + ' تازه' : 'ناموفق: ' + x.body.error, x.body.status !== 'ok'); load3(); }); } }),
            h('button', { class: 'btn sm', text: 'ویرایش', onclick: function () { sourceForm(s, load3); } }),
            h('button', { class: 'btn bad sm', text: 'حذف', onclick: function () { if (confirm('این منبع حذف شود؟')) api('/admin/bot/sources/' + s.id, { method: 'DELETE' }).then(function (x) { if (!x.ok) return fail(x); load3(); }); } })
          ])
        ]));
      });
    });
    api('/admin/bot/runs').then(function (r) {
      clear(runs);
      if (!r.ok || !r.body.runs.length) return runs.appendChild(empty('اجرایی ثبت نشده'));
      runs.appendChild(h('div', { class: 'tbl-wrap' }, [h('table', {}, [h('thead', {}, [h('tr', {}, ['زمان', 'وضعیت', 'پیدا شد', 'تازه', 'خطا'].map(function (t) { return h('th', { text: t }); }))]),
        h('tbody', {}, r.body.runs.map(function (x) { return h('tr', {}, [h('td', { text: ago(x.startedAt) }), h('td', {}, [badge(x.status === 'ok' ? 'موفق' : x.status === 'failed' ? 'ناموفق' : 'در حال اجرا', x.status === 'ok' ? 'b-ok' : x.status === 'failed' ? 'b-bad' : 'b-info')]), h('td', { class: 'num', text: fa(x.foundCount) }), h('td', { class: 'num', text: fa(x.newCount) }), h('td', { text: x.errorText || '' })]); }))])]));
    });
  }
  load3();
};
function sourceForm(s, done) {
  s = s || { name: '', url: '', adapter: 'html_table', sourceType: 'website', enabled: true, everyHours: 24, notes: '', options: {} };
  var name = h('input', { type: 'text', value: s.name }), url = h('input', { type: 'url', dir: 'ltr', value: s.url, placeholder: 'https://…' });
  var adapter = select(Object.keys(ADAPTER_HELP).map(function (k) { return [k, ADAPTER_HELP[k].label]; }), s.adapter);
  var stype = select(Object.keys(SRC_FA).map(function (k) { return [k, SRC_FA[k]]; }), s.sourceType);
  var every = h('input', { type: 'number', min: 1, max: 720, value: s.everyHours }), enabled = h('input', { type: 'checkbox', checked: s.enabled });
  var notes = h('textarea', { placeholder: 'یادداشت درباره‌ی منبع (اختیاری)' }); notes.value = s.notes || '';
  var optsBox = h('div', { class: 'form-grid' }), optInputs = {};
  function drawOpts() {
    clear(optsBox); optInputs = {};
    ADAPTER_HELP[adapter.value].opts.forEach(function (o) {
      var long = o[0] === 'pattern';
      var inp = h(long ? 'textarea' : 'input', { type: 'text', dir: 'ltr', placeholder: o[2] });
      inp.value = s.options[o[0]] !== undefined ? s.options[o[0]] : '';
      optInputs[o[0]] = inp; optsBox.appendChild(field(o[1], inp));
    });
  }
  adapter.addEventListener('change', drawOpts); drawOpts();
  var body = h('div', { style: 'display:flex;flex-direction:column;gap:12px' }, [
    h('div', { class: 'form-grid' }, [field('نام منبع', name), field('آدرس صفحه یا فایل', url), field('روش خواندن', adapter), field('نوع منبع (برای ثبت در قیمت)', stype), field('هر چند ساعت یک بار', every), h('label', { class: 'f' }, ['روشن', enabled])]),
    h('div', {}, [h('div', { text: 'تنظیم روش خواندن', style: 'font-weight:700;margin-bottom:6px' }), optsBox]),
    field('یادداشت', notes),
    h('div', { class: 'quote', text: 'ربات فقط پیشنهاد می‌سازد و هیچ قیمتی را خودش تأیید نمی‌کند. مطمئن شو شرایط استفاده‌ی آن سایت اجازه‌ی خواندن خودکار را می‌دهد.' })
  ]);
  modal(s.id ? 'ویرایش منبع' : 'منبع جدید', body, [{ label: 'انصراف' }, { label: 'ذخیره', cls: 'primary', keepOpen: true, run: function (close) {
    var options = {}; Object.keys(optInputs).forEach(function (k) { var v = optInputs[k].value.trim(); if (v) options[k] = v; });
    var payload = { name: name.value.trim(), url: url.value.trim(), adapter: adapter.value, sourceType: stype.value, enabled: enabled.checked, everyHours: Number(every.value) || 24, notes: notes.value.trim() || null, options: options };
    api(s.id ? '/admin/bot/sources/' + s.id : '/admin/bot/sources', { method: s.id ? 'PUT' : 'POST', body: payload }).then(function (r) { if (!r.ok) return fail(r); toast('ذخیره شد'); close(); done(); });
    return false; } }]);
}

/* ---------------- daily reward ---------------- */
VIEWS.daily = function (root) {
  api('/admin/daily-reward').then(function (r) {
    if (r.status === 404) return root.appendChild(empty('جایزه‌ی روزانه روی این سرور فعال نیست (دیتابیس لازم است)'));
    if (!r.ok) return fail(r);
    var steps = r.body.steps.slice(), box = h('div'), inputs = [];
    function draw() {
      clear(box); inputs = [];
      var grid = h('div', { class: 'form-grid' });
      steps.forEach(function (v, i) { var inp = h('input', { type: 'number', min: 1, max: 10000, value: v }); inputs.push(inp); grid.appendChild(field('روز ' + fa(i + 1), inp)); });
      box.appendChild(grid);
      box.appendChild(h('div', { style: 'display:flex;gap:8px;margin-top:12px' }, [
        h('button', { class: 'btn', text: '＋ افزودن روز', onclick: function () { steps = read(); steps.push(steps[steps.length - 1] || 10); draw(); } }),
        h('button', { class: 'btn bad', text: 'حذف آخرین روز', onclick: function () { steps = read(); if (steps.length > 1) steps.pop(); draw(); } }),
        h('span', { style: 'flex:1' }),
        h('button', { class: 'btn primary', text: 'ذخیره', onclick: function () { api('/admin/daily-reward', { method: 'PUT', body: { steps: read() } }).then(function (x) { if (!x.ok) return fail(x); steps = x.body.steps; toast('مبلغ‌ها ذخیره شد'); draw(); }); } })
      ]));
    }
    function read() { return inputs.map(function (i) { return Number(i.value); }); }
    root.appendChild(card('جایزه‌ی روزانه', 'مبلغ هر روز از زنجیره. بعد از آخرین روز همان مبلغ تکرار می‌شود. اگر یک روز کامل جا بیفتد از روز اول شروع می‌شود.', [box]));
    root.appendChild(card('قوانین زمان', '', [h('div', { class: 'quote', text: 'فاصله‌ی دریافت و مهلت ادامه‌ی زنجیره را از بخش «تنظیمات ← اقتصاد» عوض کن.' }), h('a', { href: '#/settings', text: 'رفتن به تنظیمات' })]));
    draw();
  });
};

/* ---------------- settings ---------------- */
var GROUP_FA = { gameplay: 'بازی', scoring: 'امتیاز', profile: 'پروفایل', economy: 'اقتصاد', chart: 'نمودار', bot: 'ربات محتوا' };
VIEWS.settings = function (root) {
  var group = load('settings.group') || 'gameplay', tabs = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px' }), box = h('div'), rows = [];
  root.appendChild(tabs); root.appendChild(box);
  function draw() {
    clear(tabs); clear(box);
    Object.keys(GROUP_FA).forEach(function (g) { tabs.appendChild(h('button', { class: 'chip', 'aria-pressed': String(g === group), text: GROUP_FA[g], onclick: function () { group = g; store('settings.group', g); draw(); } })); });
    var items = rows.filter(function (r) { return r.group === group; });
    box.appendChild(card(GROUP_FA[group], 'تغییرها همان لحظه ذخیره می‌شود و تا چند ثانیه روی سرور اثر می‌گذارد.', items.map(function (r) {
      var inp = h('input', { type: r.kind === 'bool' ? 'checkbox' : 'text', dir: 'ltr', value: Array.isArray(r.value) ? r.value.join(',') : String(r.value), checked: r.kind === 'bool' ? r.value === 1 : undefined });
      var def = Array.isArray(r.default) ? r.default.join(',') : String(r.default);
      return h('div', { class: 'setting' }, [
        h('div', {}, [h('div', { class: 'l', text: r.label + (r.unit ? ' (' + r.unit + ')' : '') }), r.hint ? h('div', { class: 'h', text: r.hint }) : null, h('div', { class: 'h ltr', text: r.key + ' · پیش‌فرض ' + def })]),
        r.kind === 'bool' ? h('label', { class: 'f' }, [inp]) : inp,
        h('div', { style: 'display:flex;gap:6px;align-items:center' }, [
          r.overridden ? badge('تغییر‌یافته', 'b-warn') : null,
          h('button', { class: 'btn primary sm', text: 'ذخیره', onclick: function () {
            var val = r.kind === 'bool' ? (inp.checked ? 1 : 0) : inp.value;
            api('/admin/settings/' + encodeURIComponent(r.key), { method: 'PUT', body: { value: val } }).then(function (x) { if (!x.ok) return fail(x); rows = x.body.settings; toast('ذخیره شد'); draw(); });
          } }),
          r.overridden ? h('button', { class: 'btn sm', text: 'پیش‌فرض', onclick: function () { api('/admin/settings/' + encodeURIComponent(r.key), { method: 'DELETE' }).then(function (x) { if (!x.ok) return fail(x); rows = x.body.settings; toast('به پیش‌فرض برگشت'); draw(); }); } }) : null
        ])
      ]);
    })));
  }
  api('/admin/settings').then(function (r) { if (r.status === 404) return root.appendChild(empty('تنظیمات روی این سرور فعال نیست (دیتابیس لازم است)')); if (!r.ok) return fail(r); rows = r.body.settings; draw(); });
};

/* ---------------- users ---------------- */
VIEWS.users = function (root) {
  var q = h('input', { type: 'search', placeholder: 'جستجوی اسم یا شناسه…' }), tableBox = h('div'), t;
  root.appendChild(h('div', { class: 'toolbar' }, [q])); root.appendChild(tableBox);
  function loadU() {
    api('/admin/users?q=' + encodeURIComponent(q.value)).then(function (r) {
      clear(tableBox);
      if (r.status === 404) return tableBox.appendChild(empty('مدیریت کاربران روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      if (!r.body.users.length) return tableBox.appendChild(empty('کاربری پیدا نشد'));
      tableBox.appendChild(h('div', { class: 'tbl-wrap' }, [h('table', {}, [h('thead', {}, [h('tr', {}, ['کاربر', 'سکه', 'ثبت‌نام', 'آخرین حضور', 'وضعیت', ''].map(function (x) { return h('th', { text: x }); }))]),
        h('tbody', {}, r.body.users.map(function (u) { return h('tr', {}, [h('td', {}, [h('b', { text: u.nickname }), h('div', { class: 'ltr', style: 'color:var(--muted);font-size:11px', text: u.id })]), h('td', { class: 'num', text: faNum(u.balance) }), h('td', { text: ago(u.createdAt) }), h('td', { text: ago(u.lastSeenAt) }), h('td', {}, [u.isBanned ? badge('مسدود', 'b-bad') : badge('فعال', 'b-ok')]), h('td', {}, [h('button', { class: 'btn sm', text: 'مدیریت', onclick: function () { userModal(u, loadU); } })])]); }))])]));
    });
  }
  q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(loadU, 250); });
  loadU();
};
function userModal(u, done) {
  var delta = h('input', { type: 'number', placeholder: 'مثلاً 50 یا -20' }), ledger = h('div');
  function loadL() { api('/admin/users/' + u.id + '/ledger').then(function (r) { clear(ledger); if (!r.ok || !r.body.entries.length) return ledger.appendChild(empty('تراکنشی نیست')); r.body.entries.forEach(function (e) { ledger.appendChild(h('div', { class: 'kv' }, [h('span', { text: e.reason }), h('b', { class: 'num ltr', text: (e.delta > 0 ? '+' : '') + e.delta }), h('span', { style: 'color:var(--muted)', text: ago(e.at) })])); }); }); }
  loadL();
  var body = h('div', { style: 'display:flex;flex-direction:column;gap:14px' }, [
    h('div', { class: 'kv' }, [h('span', { text: 'موجودی' }), h('b', { class: 'num', text: faNum(u.balance) + ' سکه' })]),
    h('div', { style: 'display:flex;gap:8px;align-items:end' }, [field('تغییر موجودی (از طریق دفتر سکه)', delta), h('button', { class: 'btn primary', text: 'اعمال', onclick: function () {
      var d = Number(delta.value); if (!d) return toast('عدد غیرصفر وارد کن', true);
      api('/admin/users/' + u.id + '/coins', { method: 'POST', body: { delta: d } }).then(function (r) { if (!r.ok) return fail(r); u.balance = r.body.balance; toast('موجودی جدید: ' + faNum(r.body.balance)); loadL(); });
    } })]),
    h('div', {}, [u.isBanned ? h('button', { class: 'btn ok', text: 'رفع مسدودی', onclick: function () { api('/admin/users/' + u.id + '/ban', { method: 'POST', body: { banned: false } }).then(function (r) { if (!r.ok) return fail(r); toast('رفع مسدودی شد'); done(); }); } }) : h('button', { class: 'btn bad', text: 'مسدود کردن', onclick: function () { if (confirm('این کاربر مسدود شود؟')) api('/admin/users/' + u.id + '/ban', { method: 'POST', body: { banned: true } }).then(function (r) { if (!r.ok) return fail(r); toast('مسدود شد'); done(); }); } })]),
    h('div', {}, [h('div', { text: 'آخرین تراکنش‌ها', style: 'font-weight:700;margin-bottom:6px' }), ledger])
  ]);
  modal(u.nickname, body, [{ label: 'بستن', run: function () { done(); } }]);
}

/* ---------------- socket + audit ---------------- */
VIEWS.socket = function (root) {
  var box = h('div'), timer;
  root.appendChild(box);
  function pull() {
    if (S.route !== 'socket') return clearInterval(timer);
    api('/admin/socket').then(function (r) {
      if (r.status === 404) { clearInterval(timer); clear(box); return box.appendChild(empty('سرویس سوکت روی این سرور فعال نیست')); }
      if (!r.ok) return; var s = r.body; clear(box);
      box.appendChild(h('div', { class: 'grid' }, [statCard('اتصال فعال', fa(s.connections), '', '#3fc1f0'), statCard('بیشترین اتصال همزمان', fa(s.peakConnections), '', '#a66bf0'), statCard('کل اتصال‌ها', faNum(s.totalConnections), '', '#7ed957'), statCard('اتصال ردشده', fa(s.rejectedHandshakes), 'توکن نامعتبر', '#ff4d8d'), statCard('در صف', fa(s.queueLength), 'بیشترین انتظار ' + fa(s.longestWaitSec) + ' ثانیه', '#ffc93c'), statCard('مسابقه فعال', fa(s.activeMatches), '', '#ff7a3d'), statCard('زمان روشن بودن', fa(Math.floor(s.uptimeSec / 3600)) + ' ساعت', fa(Math.floor((s.uptimeSec % 3600) / 60)) + ' دقیقه', '#3fc1f0')]));
    });
  }
  pull(); timer = setInterval(pull, 3000);
};
VIEWS.audit = function (root) {
  api('/admin/audit').then(function (r) {
    if (r.status === 404) return root.appendChild(empty('گزارش تغییرها روی این سرور فعال نیست'));
    if (!r.ok) return fail(r);
    root.appendChild(card('گزارش تغییرها', 'صد تغییر آخر', r.body.entries.length ? [h('div', { class: 'tbl-wrap' }, [h('table', {}, [h('thead', {}, [h('tr', {}, ['زمان', 'کار', 'هدف', 'جزئیات'].map(function (x) { return h('th', { text: x }); }))]), h('tbody', {}, r.body.entries.map(function (e) { return h('tr', {}, [h('td', { text: ago(e.at) }), h('td', {}, [badge(e.action, 'b-info')]), h('td', { class: 'ltr', text: e.target }), h('td', { class: 'ltr', text: e.detail || '' })]); }))])])] : [empty('هنوز چیزی ثبت نشده')]));
  });
};
`;
