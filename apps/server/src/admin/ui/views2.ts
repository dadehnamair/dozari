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
    h('div', { class: 'sub', style: 'color:var(--muted);font-size:13px' }, ['منبع: ', h('b', { text: c.sourceName || 'نامشخص' }), ' · ', h('a', { href: safeHref(c.sourceUrl), target: '_blank', rel: 'noopener noreferrer', text: 'باز کردن صفحه' }), ' · ' + ago(c.createdAt)]),
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
var GROUP_FA = { app: 'مدیریت اپ', gameplay: 'بازی', scoring: 'امتیاز', profile: 'پروفایل', economy: 'اقتصاد', chart: 'نمودار', bot: 'ربات محتوا', notify: 'اعلان‌های بله', review: 'نظر در فروشگاه‌ها' };
VIEWS.settings = function (root) {
  var group = load('settings.group') || 'app', tabs = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px' }), box = h('div'), rows = [];
  root.appendChild(tabs); root.appendChild(box);
  function draw() {
    clear(tabs); clear(box);
    Object.keys(GROUP_FA).forEach(function (g) { tabs.appendChild(h('button', { class: 'chip', 'aria-pressed': String(g === group), text: GROUP_FA[g], onclick: function () { group = g; store('settings.group', g); draw(); } })); });
    var items = rows.filter(function (r) { return r.group === group; });
    box.appendChild(card(GROUP_FA[group], 'تغییرها همان لحظه ذخیره می‌شود و تا چند ثانیه روی سرور اثر می‌گذارد.', items.map(function (r) {
      var inp = h('input', { type: r.kind === 'bool' ? 'checkbox' : 'text', dir: r.kind === 'text' ? 'auto' : 'ltr', maxlength: r.kind === 'text' ? r.max : undefined, value: Array.isArray(r.value) ? r.value.join(',') : String(r.value), checked: r.kind === 'bool' ? r.value === 1 : undefined });
      var def = Array.isArray(r.default) ? r.default.join(',') : String(r.default) || '(خالی)';
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
  var q = h('input', { type: 'search', placeholder: 'جستجوی اسم یا شناسه…' }), tableBox = h('div'), t, st = { filter: load('users.filter') || 'all', sort: load('users.sort') || 'lastSeen', offset: 0 };
  var FILT = [['all', 'همه'], ['new', 'تازه‌ها'], ['banned', 'مسدودها']], SORT = [['lastSeen', 'آخرین حضور'], ['created', 'تازه‌ترین'], ['coins', 'بیشترین سکه']];
  var chips = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }), sortSel = select(SORT, st.sort);
  sortSel.addEventListener('change', function () { st.sort = sortSel.value; store('users.sort', st.sort); st.offset = 0; loadU(); });
  function drawChips() { clear(chips); FILT.forEach(function (f) { chips.appendChild(h('button', { class: 'chip', 'aria-pressed': String(st.filter === f[0]), text: f[1], onclick: function () { st.filter = f[0]; store('users.filter', f[0]); st.offset = 0; drawChips(); loadU(); } })); }); }
  drawChips();
  root.appendChild(h('div', { class: 'toolbar' }, [q, chips, h('span', { style: 'flex:1' }), sortSel])); root.appendChild(tableBox);
  function loadU() {
    api('/admin/users?q=' + encodeURIComponent(q.value) + '&filter=' + st.filter + '&sort=' + st.sort + '&offset=' + st.offset).then(function (r) {
      clear(tableBox);
      if (r.status === 404) return tableBox.appendChild(empty('مدیریت کاربران روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      if (!r.body.users.length) return tableBox.appendChild(empty('کاربری پیدا نشد'));
      tableBox.appendChild(h('div', { class: 'tbl-wrap' }, [h('table', {}, [h('thead', {}, [h('tr', {}, ['کاربر', 'سکه', 'ثبت‌نام', 'آخرین حضور', 'وضعیت', ''].map(function (x) { return h('th', { text: x }); }))]),
        h('tbody', {}, r.body.users.map(function (u) { return h('tr', {}, [h('td', {}, [h('b', { text: u.nickname }), h('div', { class: 'ltr', style: 'color:var(--muted);font-size:11px', text: u.id })]), h('td', { class: 'num', text: faNum(u.balance) }), h('td', { text: ago(u.createdAt) }), h('td', { text: ago(u.lastSeenAt) }), h('td', {}, [u.isBanned ? badge('مسدود', 'b-bad') : badge('فعال', 'b-ok')]), h('td', {}, [h('button', { class: 'btn sm', text: 'مدیریت', onclick: function () { userModal(u.id, loadU); } })])]); }))])]));
      tableBox.appendChild(h('div', { class: 'toolbar', style: 'justify-content:center' }, [
        st.offset > 0 ? h('button', { class: 'btn sm', text: '← قبلی', onclick: function () { st.offset = Math.max(0, st.offset - 50); loadU(); } }) : null,
        r.body.users.length === 50 ? h('button', { class: 'btn sm', text: 'بعدی →', onclick: function () { st.offset += 50; loadU(); } }) : null
      ]));
    });
  }
  q.addEventListener('input', function () { clearTimeout(t); st.offset = 0; t = setTimeout(loadU, 250); });
  loadU();
};
var GENDER_FA = { female: 'خانم', male: 'آقا' };
function userModal(id, done) {
  var box = h('div', { style: 'display:flex;flex-direction:column;gap:14px' });
  modal('کاربر', box, [{ label: 'بستن', run: function () { done(); } }]);
  function draw() {
    api('/admin/users/' + id).then(function (r) {
      clear(box);
      if (!r.ok) return fail(r);
      var u = r.body;
      var delta = h('input', { type: 'number', placeholder: 'مثلاً 50 یا -20' }), reason = h('input', { type: 'text', placeholder: 'دلیل مسدودی (اختیاری)', maxlength: 200 });
      var nick = h('input', { type: 'text', value: u.nickname, maxlength: 30 }), note = h('input', { type: 'text', placeholder: 'یادداشت خصوصی برای ادمین‌ها', maxlength: 500 }), ledger = h('div');
      api('/admin/users/' + id + '/ledger').then(function (x) { clear(ledger); if (!x.ok || !x.body.entries.length) return ledger.appendChild(empty('تراکنشی نیست')); x.body.entries.forEach(function (e) { ledger.appendChild(h('div', { class: 'kv' }, [h('span', { text: e.reason }), h('b', { class: 'num ltr', text: (e.delta > 0 ? '+' : '') + e.delta }), h('span', { style: 'color:var(--muted)', text: ago(e.at) })])); }); });
      box.appendChild(h('div', {}, [
        h('div', { class: 'kv' }, [h('span', { text: 'شناسه' }), h('span', { class: 'ltr', text: u.id })]),
        h('div', { class: 'kv' }, [h('span', { text: 'موجودی' }), h('b', { class: 'num', text: faNum(u.balance) + ' سکه' })]),
        h('div', { class: 'kv' }, [h('span', { text: 'ثبت‌نام' }), h('span', { text: ago(u.createdAt) })]),
        h('div', { class: 'kv' }, [h('span', { text: 'آخرین حضور' }), h('span', { text: ago(u.lastSeenAt) })]),
        h('div', { class: 'kv' }, [h('span', { text: 'دوستان' }), h('b', { class: 'num', text: fa(u.friends) })]),
        h('div', { class: 'kv' }, [h('span', { text: 'جنسیت (خصوصی)' }), h('span', { text: GENDER_FA[u.gender] || 'نگفته' })]),
        h('div', { class: 'kv' }, [h('span', { text: 'بله' }), u.baleLinked ? badge('وصل است', 'b-ok') : badge('وصل نیست', 'b-mute')]),
        u.isBanned ? h('div', { class: 'kv' }, [h('span', { text: 'مسدود از' }), h('span', { text: (u.bannedAt ? ago(u.bannedAt) : '') + (u.banReason ? ' — ' + u.banReason : '') })]) : null
      ]));
      box.appendChild(h('div', { style: 'display:flex;gap:8px;align-items:end' }, [field('تغییر موجودی (از طریق دفتر سکه)', delta), h('button', { class: 'btn primary', text: 'اعمال', onclick: function () {
        var d = Number(delta.value); if (!d) return toast('عدد غیرصفر وارد کن', true);
        api('/admin/users/' + id + '/coins', { method: 'POST', body: { delta: d } }).then(function (x) { if (!x.ok) return fail(x); toast('موجودی جدید: ' + faNum(x.body.balance)); draw(); });
      } })]));
      box.appendChild(h('div', { style: 'display:flex;gap:8px;align-items:end' }, [field('اسم نمایشی', nick), h('button', { class: 'btn', text: 'ذخیره‌ی اسم', onclick: function () { api('/admin/users/' + id + '/identity', { method: 'PUT', body: { nickname: nick.value.trim() } }).then(function (x) { if (!x.ok) return fail(x); toast('اسم عوض شد'); draw(); }); } }),
        h('button', { class: 'btn', text: 'اسم و آواتار تصادفی', onclick: function () { if (confirm('اسم و آواتار این بازیکن با یک هویت تصادفی عوض شود؟')) api('/admin/users/' + id + '/identity', { method: 'PUT', body: {} }).then(function (x) { if (!x.ok) return fail(x); toast('هویت جدید داده شد'); draw(); }); } })]));
      box.appendChild(h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:end' }, [
        u.isBanned ? h('button', { class: 'btn ok', text: 'رفع مسدودی', onclick: function () { api('/admin/users/' + id + '/ban', { method: 'POST', body: { banned: false } }).then(function (x) { if (!x.ok) return fail(x); toast('رفع مسدودی شد'); draw(); }); } })
          : h('span', { style: 'display:flex;gap:8px;align-items:end' }, [reason, h('button', { class: 'btn bad', text: 'مسدود کردن', onclick: function () { if (confirm('این کاربر مسدود شود؟ نشست‌هایش هم بسته می‌شود.')) api('/admin/users/' + id + '/ban', { method: 'POST', body: { banned: true, reason: reason.value.trim() || null } }).then(function (x) { if (!x.ok) return fail(x); toast('مسدود شد'); draw(); }); } })]),
        h('button', { class: 'btn', text: 'خروج از همه‌ی دستگاه‌ها', onclick: function () { if (confirm('همه‌ی نشست‌های این بازیکن بسته شود؟ دفعه‌ی بعد دوباره وارد می‌شود.')) api('/admin/users/' + id + '/logout', { method: 'POST', body: {} }).then(function (x) { if (!x.ok) return fail(x); toast('نشست‌ها بسته شد'); }); } })
      ]));
      var notes = h('div');
      u.notes.forEach(function (n) { notes.appendChild(h('div', { class: 'kv' }, [h('span', { text: n.note }), h('span', { style: 'color:var(--muted);font-size:12px', text: ago(n.at) }), h('button', { class: 'btn bad sm', text: 'حذف', onclick: function () { api('/admin/user-notes/' + n.id, { method: 'DELETE' }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })])); });
      box.appendChild(h('div', {}, [h('div', { text: 'یادداشت‌های ادمین', style: 'font-weight:700;margin-bottom:6px' }), notes, h('div', { style: 'display:flex;gap:8px;margin-top:6px' }, [note, h('button', { class: 'btn', text: 'افزودن', onclick: function () { if (!note.value.trim()) return; api('/admin/users/' + id + '/notes', { method: 'POST', body: { note: note.value.trim() } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })])]));
      box.appendChild(h('div', {}, [h('div', { text: 'آخرین تراکنش‌ها', style: 'font-weight:700;margin-bottom:6px' }), ledger]));
    });
  }
  draw();
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
VIEWS.words = function (root) {
  var list = h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' });
  var word = h('input', { type: 'text', placeholder: 'کلمه…', maxlength: 100 });
  var sev = select([['block', 'مسدود (پیام ارسال نمی‌شود)'], ['mask', 'ستاره‌دار (کلمه با * جایگزین می‌شود)']], 'block');
  var test = h('input', { type: 'text', placeholder: 'یک متن بنویس تا ببینی چه می‌شود' }), verdict = h('div');
  function draw() {
    api('/admin/words').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('فیلتر کلمات روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      if (!r.body.words.length) list.appendChild(empty('هنوز کلمه‌ای اضافه نشده؛ فیلتر تا وقتی کلمه‌ای نباشد چیزی را رد نمی‌کند.'));
      r.body.words.forEach(function (w) {
        list.appendChild(h('span', { class: 'chip', style: 'display:inline-flex;gap:6px;align-items:center' }, [
          h('span', { text: w.word }), badge(w.severity === 'block' ? 'مسدود' : 'ستاره', w.severity === 'block' ? 'b-bad' : 'b-warn'),
          h('button', { class: 'btn sm', text: w.severity === 'block' ? 'ستاره‌دار' : 'مسدود', onclick: function () { api('/admin/words/' + w.id, { method: 'PATCH', body: { severity: w.severity === 'block' ? 'mask' : 'block' } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } }),
          h('button', { class: 'btn bad sm', text: 'حذف', onclick: function () { api('/admin/words/' + w.id, { method: 'DELETE' }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })
        ]));
      });
    });
  }
  root.appendChild(card('افزودن کلمه', 'املا و ریخت‌های مختلف (ی/ي، ک/ك، نیم‌فاصله، حروف تکراری، حروف جداشده) خودکار گرفته می‌شود؛ فقط خود کلمه را بنویس.', [
    h('div', { class: 'toolbar' }, [word, sev, h('button', { class: 'btn primary', text: 'افزودن', onclick: function () {
      api('/admin/words', { method: 'POST', body: { word: word.value.trim(), severity: sev.value } }).then(function (x) { if (x.status === 409) return toast('این کلمه از قبل هست', true); if (!x.ok) return fail(x); word.value = ''; draw(); });
    } })])
  ]));
  root.appendChild(card('فهرست', 'روی همه‌ی متن‌هایی که بازیکن تایپ می‌کند (چت و ...) در سرور اجرا می‌شود', [list]));
  root.appendChild(card('آزمایش', 'متن آزمایشی ذخیره نمی‌شود', [h('div', { class: 'toolbar' }, [test, h('button', { class: 'btn', text: 'بررسی', onclick: function () {
    api('/admin/words/test', { method: 'POST', body: { text: test.value } }).then(function (x) {
      if (!x.ok) return fail(x); clear(verdict);
      verdict.appendChild(x.body.ok ? badge('قبول: ' + x.body.text, 'b-ok') : badge('رد شد (کلمه‌ی «' + x.body.hit.word + '»)', 'b-bad'));
    });
  } })]), verdict]));
  draw();
};
VIEWS.cities = function (root) {
  var list = h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' });
  var slug = h('input', { type: 'text', dir: 'ltr', placeholder: 'شناسه‌ی لاتین (مثل tehran)', maxlength: 40 });
  var name = h('input', { type: 'text', placeholder: 'نام شهر', maxlength: 60 });
  function draw() {
    api('/admin/cities').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('بخش شهرها روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      r.body.cities.forEach(function (c) {
        list.appendChild(h('span', { class: 'chip', style: 'display:inline-flex;gap:6px;align-items:center' }, [
          h('span', { text: c.nameFa }), c.isActive ? null : badge('پنهان', 'b-warn'),
          h('button', { class: 'btn sm', text: c.isActive ? 'پنهان کن' : 'نشان بده', onclick: function () { api('/admin/cities/' + c.id, { method: 'PATCH', body: { isActive: !c.isActive } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })
        ]));
      });
    });
  }
  root.appendChild(card('افزودن شهر', 'بازیکن‌ها شهرشان را از این فهرست انتخاب می‌کنند؛ پنهان‌کردن، شهرِ کسانی که قبلاً انتخاب کرده‌اند را عوض نمی‌کند.', [
    h('div', { class: 'toolbar' }, [slug, name, h('button', { class: 'btn primary', text: 'افزودن', onclick: function () {
      api('/admin/cities', { method: 'POST', body: { slug: slug.value.trim(), nameFa: name.value.trim() } }).then(function (x) { if (x.status === 409) return toast('این شناسه از قبل هست', true); if (!x.ok) return fail(x); slug.value = ''; name.value = ''; draw(); });
    } })])
  ]));
  root.appendChild(card('فهرست شهرها', null, [list]));
  draw();
};
VIEWS.shop = function (root) {
  var list = h('div');
  function num(v, min) { return h('input', { type: 'number', value: v, min: min === undefined ? 0 : min, style: 'width:90px' }); }
  function row(it) {
    var price = num(it.priceCoins), lvl = num(it.minLevel, 1), lim = num(it.perDayLimit), amt = num(it.amount, 1);
    function save(patch) { api('/admin/shop/' + it.id, { method: 'PATCH', body: patch }).then(function (x) { if (!x.ok) return fail(x); toast('ذخیره شد'); draw(); }); }
    return h('div', { class: 'card', style: 'padding:12px' }, [
      h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
        h('b', { text: it.titleFa }), it.isActive ? badge('فعال', 'b-ok') : badge('پنهان', 'b-warn'), h('span', { class: 'h', text: it.descriptionFa })
      ]),
      h('div', { class: 'toolbar', style: 'margin-top:8px' }, [
        field('قیمت (سکه)', price), field('تعداد در هر خرید', amt), field('کمترین لول', lvl), field('سقف خرید در روز (۰ = بی‌سقف)', lim),
        h('button', { class: 'btn primary', text: 'ذخیره', onclick: function () { save({ priceCoins: +price.value, amount: +amt.value, minLevel: +lvl.value, perDayLimit: +lim.value }); } }),
        h('button', { class: 'btn', text: it.isActive ? 'پنهان کن' : 'فعال کن', onclick: function () { save({ isActive: !it.isActive }); } })
      ])
    ]);
  }
  function draw() {
    api('/admin/shop').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('فروشگاه روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      r.body.items.forEach(function (it) { list.appendChild(row(it)); });
    });
  }
  var title = h('input', { type: 'text', placeholder: 'نام آیتم', maxlength: 80 }), desc = h('input', { type: 'text', placeholder: 'توضیح کوتاه برای بازیکن', maxlength: 300 });
  var price = num(20), amt = num(1, 1), lvl = num(1, 1), lim = num(0);
  root.appendChild(card('قیمت راهنما در بازی تکی', 'قیمت هر راهنما، لول لازم و سقف راهنما در هر بازی در بخش «تنظیمات ← اقتصاد» است.', []));
  root.appendChild(card('آیتم‌های فروشگاه', 'هر آیتم با سکه خریده می‌شود و «توکن راهنما» می‌دهد؛ توکن به جای سکه در بازی تکی خرج می‌شود. بازیکن شرط لول و سقف روزانه را قبل از خرید می‌بیند.', [list]));
  root.appendChild(card('آیتم تازه', 'نوع اثر فعلاً فقط «توکن راهنما» است.', [
    h('div', { class: 'toolbar' }, [title, desc]),
    h('div', { class: 'toolbar' }, [field('قیمت (سکه)', price), field('تعداد توکن', amt), field('کمترین لول', lvl), field('سقف در روز', lim), h('button', { class: 'btn primary', text: 'افزودن', onclick: function () {
      api('/admin/shop', { method: 'POST', body: { titleFa: title.value.trim(), descriptionFa: desc.value.trim(), effect: 'hint_token', amount: +amt.value, priceCoins: +price.value, minLevel: +lvl.value, perDayLimit: +lim.value, iconKey: 'magnifier', isActive: true } }).then(function (x) { if (!x.ok) return fail(x); title.value = ''; desc.value = ''; draw(); });
    } })])
  ]));
  draw();
};
VIEWS.invites = function (root) {
  var list = h('div');
  function draw() {
    api('/admin/invites').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('کد معرف روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      if (!r.body.codes.length) return list.appendChild(empty('هنوز کدی ساخته نشده'));
      r.body.codes.forEach(function (c) {
        var max = h('input', { type: 'number', value: c.maxUses, min: 1, style: 'width:90px' });
        list.appendChild(h('div', { class: 'toolbar', style: 'padding:6px 0;border-bottom:1px solid var(--line,#ddd)' }, [
          h('b', { text: c.code, dir: 'ltr' }), c.label ? badge(c.label, 'b-warn') : badge('کد شخصی', 'b-ok'), c.isActive ? null : badge('غیرفعال', 'b-bad'),
          h('span', { text: 'استفاده: ' + fa(c.uses) + ' از ' }), max,
          h('button', { class: 'btn sm', text: 'ذخیره', onclick: function () { api('/admin/invites/' + c.code, { method: 'PATCH', body: { maxUses: +max.value } }).then(function (x) { if (!x.ok) return fail(x); toast('ذخیره شد'); draw(); }); } }),
          h('button', { class: 'btn sm ' + (c.isActive ? 'bad' : ''), text: c.isActive ? 'غیرفعال کن' : 'فعال کن', onclick: function () { api('/admin/invites/' + c.code, { method: 'PATCH', body: { isActive: !c.isActive } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })
        ]));
      });
    });
  }
  var code = h('input', { type: 'text', dir: 'ltr', placeholder: 'کد (مثل NOWRUZ)', maxlength: 12 }), label = h('input', { type: 'text', placeholder: 'نام کمپین', maxlength: 80 }), uses = h('input', { type: 'number', value: 100, min: 1, style: 'width:110px' });
  root.appendChild(card('کد معرف ویژه (کمپین)', 'کد کمپین معرفی ندارد، پس پاداش معرف پرداخت نمی‌شود؛ فقط دعوت‌شده سکه‌ی خوش‌آمد و فعال‌شدن حساب را می‌گیرد. حروف و عددهای شبیه به هم (۰ O ۱ I L) مجاز نیستند.', [
    h('div', { class: 'toolbar' }, [code, label, field('تعداد استفاده', uses), h('button', { class: 'btn primary', text: 'ساخت', onclick: function () {
      api('/admin/invites', { method: 'POST', body: { code: code.value, label: label.value.trim(), maxUses: +uses.value } }).then(function (x) { if (x.status === 409) return toast('این کد از قبل هست', true); if (!x.ok) return fail(x); code.value = ''; label.value = ''; draw(); });
    } })])
  ]));
  root.appendChild(card('همه‌ی کدها', 'سقف استفاده‌ی کد شخصی و پاداش‌ها در «تنظیمات ← اقتصاد» است. غیرفعال‌کردن یک کد جلوی دعوت تازه را می‌گیرد، حساب‌های دعوت‌شده‌ی قبلی بدون تغییر می‌مانند.', [list]));
  draw();
};
VIEWS.bale = function (root) {
  var body = h('div'), msg = h('textarea', { placeholder: 'متن پیام برای همه‌ی بازیکنان وصل‌شده…', maxlength: 1000 }), chat = h('input', { type: 'text', dir: 'ltr', placeholder: 'شناسه‌ی چت (عدد)' });
  function draw() {
    api('/admin/bale').then(function (r) {
      clear(body);
      if (r.status === 404) return body.appendChild(empty('ربات بله روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      var d = r.body;
      body.appendChild(h('div', { class: 'grid' }, [
        statCard('وضعیت ربات', d.configured ? 'روشن' : 'خاموش', d.configured ? (d.botUsername ? '@' + d.botUsername : 'نام کاربری تنظیم نشده') : 'BALE_BOT_TOKEN تنظیم نشده', d.configured ? '#7ed957' : '#ff4d8d'),
        statCard('بازیکنان وصل‌شده', faNum(d.linked), 'کسانی که حسابشان را با کد وصل کرده‌اند', '#3fc1f0'),
        statCard('در صف ارسال', faNum(d.outbox.pending), fa(d.outbox.sent) + ' فرستاده‌شده · ' + fa(d.outbox.failed) + ' ناموفق', '#ffc93c')
      ]));
      body.appendChild(card('آخرین پیام‌ها', 'بیست پیام آخر صف ارسال', d.outbox.recent.length ? [h('div', { class: 'tbl-wrap' }, [h('table', {}, [h('thead', {}, [h('tr', {}, ['زمان', 'نوع', 'وضعیت', 'متن', 'خطا'].map(function (x) { return h('th', { text: x }); }))]),
        h('tbody', {}, d.outbox.recent.map(function (e) { return h('tr', {}, [h('td', { text: ago(e.at) }), h('td', {}, [badge(e.kind, 'b-info')]), h('td', {}, [badge(e.status === 'sent' ? 'فرستاده شد' : e.status === 'pending' ? 'در انتظار' : 'ناموفق', e.status === 'sent' ? 'b-ok' : e.status === 'pending' ? 'b-info' : 'b-bad')]), h('td', { text: e.text.slice(0, 80) }), h('td', { class: 'ltr', text: e.lastError || '' })]); }))])])] : [empty('هنوز پیامی نیست')]));
    });
  }
  root.appendChild(body);
  root.appendChild(card('پیام همگانی', 'همین متن برای همه‌ی بازیکنانی که بله را وصل کرده‌اند در صف می‌رود', [msg, h('div', { class: 'toolbar' }, [h('button', { class: 'btn primary', text: 'ارسال به همه', onclick: function () {
    if (!msg.value.trim() || !confirm('این پیام برای همه‌ی بازیکنان وصل‌شده فرستاده شود؟')) return;
    api('/admin/bale/broadcast', { method: 'POST', body: { text: msg.value.trim() } }).then(function (x) { if (!x.ok) return fail(x); toast(fa(x.body.queued) + ' پیام در صف رفت'); msg.value = ''; draw(); });
  } })])]));
  root.appendChild(card('پیام آزمایشی', 'شناسه‌ی چت خودت را بده؛ ربات یک پیام کوتاه برایت می‌فرستد', [h('div', { class: 'toolbar' }, [chat, h('button', { class: 'btn', text: 'ارسال آزمایشی', onclick: function () {
    api('/admin/bale/test', { method: 'POST', body: { chatId: chat.value.trim() } }).then(function (x) { if (!x.ok) return fail(x); toast('در صف رفت'); draw(); });
  } })])]));
  draw();
};
var CH_FA = { in_app: 'صندوق داخل اپ', bale: 'بله', sms: 'پیامک', email: 'ایمیل', push: 'اعلان پوش' };
var AUD_FA = { all: 'همه‌ی بازیکنان', bale_linked: 'وصل‌شده‌ها به بله', user: 'یک بازیکن' };
VIEWS.messages = function (root) {
  var title = h('input', { type: 'text', placeholder: 'عنوان', maxlength: 150 }), text = h('textarea', { placeholder: 'متن پیام…', maxlength: 2000 });
  var aud = select([['all', AUD_FA.all], ['bale_linked', AUD_FA.bale_linked], ['user', AUD_FA.user]], 'all');
  var target = h('input', { type: 'text', dir: 'ltr', placeholder: 'شناسه‌ی بازیکن (از بخش کاربران)', style: 'display:none' });
  aud.addEventListener('change', function () { target.style.display = aud.value === 'user' ? '' : 'none'; });
  var chBox = h('div', { style: 'display:flex;flex-direction:column;gap:6px' }), checks = {};
  var hist = h('div');
  function drawHistory() {
    api('/admin/messages').then(function (r) {
      clear(hist);
      if (r.status === 404) return hist.appendChild(empty('مرکز پیام روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      if (!r.body.messages.length) return hist.appendChild(empty('هنوز پیامی نفرستاده‌ای'));
      hist.appendChild(h('div', { class: 'tbl-wrap' }, [h('table', {}, [h('thead', {}, [h('tr', {}, ['زمان', 'عنوان', 'مخاطب', 'کانال‌ها', ''].map(function (x) { return h('th', { text: x }); }))]),
        h('tbody', {}, r.body.messages.map(function (m) {
          return h('tr', {}, [h('td', { text: ago(m.sentAt) }), h('td', {}, [h('b', { text: m.title }), h('div', { class: 'sub', style: 'color:var(--muted);font-size:12px', text: m.body.slice(0, 80) })]),
            h('td', { text: AUD_FA[m.audience] || m.audience }),
            h('td', {}, m.channels.map(function (c) { return badge((CH_FA[c.channel] || c.channel) + ' ' + fa(c.recipients), 'b-info'); })),
            h('td', {}, [m.retracted ? badge('پس گرفته شد', 'b-mute') : h('button', { class: 'btn bad sm', text: 'پس گرفتن از صندوق', onclick: function () { if (confirm('این پیام از صندوق همه‌ی بازیکنان برداشته شود؟ (پیام‌های بله و ... که رفته‌اند برنمی‌گردند)')) api('/admin/messages/' + m.id, { method: 'DELETE' }).then(function (x) { if (!x.ok) return fail(x); drawHistory(); }); } })])]);
        }))])]));
    });
  }
  api('/admin/messages/channels').then(function (r) {
    if (!r.ok) return;
    r.body.channels.forEach(function (c) {
      var cb = h('input', { type: 'checkbox', disabled: !c.available, checked: c.channel === 'in_app' }); checks[c.channel] = cb;
      chBox.appendChild(h('label', { style: 'display:flex;gap:8px;align-items:center;' + (c.available ? '' : 'opacity:.55') }, [cb, h('span', { text: CH_FA[c.channel] }), c.available ? null : h('span', { class: 'sub', style: 'color:var(--muted);font-size:12px', text: '— ' + c.reason })]));
    });
  });
  root.appendChild(card('پیام جدید', 'یک پیام، چند کانال. کانال‌هایی که هنوز راه نیفتاده‌اند خاموش‌اند و دلیلشان کنارشان نوشته شده.', [
    h('div', { class: 'form-grid' }, [field('عنوان', title), field('مخاطب', aud)]), target, field('متن', text), field('کانال‌ها', chBox),
    h('div', { class: 'toolbar' }, [h('button', { class: 'btn primary', text: 'ارسال', onclick: function () {
      var chans = Object.keys(checks).filter(function (k) { return checks[k].checked && !checks[k].disabled; });
      if (!title.value.trim() || !text.value.trim() || !chans.length) return toast('عنوان، متن و دست‌کم یک کانال لازم است', true);
      if (!confirm('پیام برای «' + AUD_FA[aud.value] + '» فرستاده شود؟')) return;
      api('/admin/messages', { method: 'POST', body: { title: title.value.trim(), body: text.value.trim(), audience: aud.value, targetUserId: aud.value === 'user' ? target.value.trim() : null, channels: chans } }).then(function (x) {
        if (x.status === 409) return toast('مخاطبی پیدا نشد', true);
        if (!x.ok) return fail(x);
        toast('فرستاده شد: ' + Object.keys(x.body.recipients).map(function (k) { return CH_FA[k] + ' ' + fa(x.body.recipients[k]); }).join('، '));
        title.value = ''; text.value = ''; drawHistory();
      });
    } })])
  ]));
  root.appendChild(card('پیام‌های فرستاده‌شده', 'می‌توانی پیام صندوق داخل اپ را پس بگیری', [hist]));
  drawHistory();
};
VIEWS.admins = function (root) {
  var box = h('div');
  var ROLES = [['owner', 'مالک — همه‌چیز'], ['editor', 'ویرایشگر — کاتالوگ، قیمت، ربات، فیلتر، پیام'], ['support', 'پشتیبان — کاربران'], ['viewer', 'فقط‌خواندن']];
  function draw() {
    api('/admin/admins').then(function (r) {
      clear(box);
      if (!r.ok) return fail(r);
      if (r.body.legacyToken) box.appendChild(h('div', { class: 'flag', text: 'توکن اصلی (ADMIN_TOKEN) هنوز فعال است و دسترسی کامل دارد. بعد از ساختن حساب مالک، آن را از .env بردار.' }));
      if (!r.body.admins.length) box.appendChild(empty('هنوز حسابی نیست'));
      else box.appendChild(h('div', { class: 'tbl-wrap' }, [h('table', {}, [h('thead', {}, [h('tr', {}, ['نام', 'نام کاربری', 'نقش', 'آخرین ورود', 'وضعیت', ''].map(function (x) { return h('th', { text: x }); }))]),
        h('tbody', {}, r.body.admins.map(function (a) {
          var roleSel = select(ROLES, a.role);
          roleSel.addEventListener('change', function () { api('/admin/admins/' + a.id, { method: 'PUT', body: { role: roleSel.value } }).then(function (x) { if (!x.ok) fail(x); else toast('نقش عوض شد'); draw(); }); });
          return h('tr', {}, [h('td', {}, [h('b', { text: a.displayName })]), h('td', { class: 'ltr', text: a.username }), h('td', {}, [roleSel]), h('td', { text: a.lastLoginAt ? ago(a.lastLoginAt) : 'هرگز' }),
            h('td', {}, [a.locked ? badge('قفل', 'b-warn') : a.isActive ? badge('فعال', 'b-ok') : badge('غیرفعال', 'b-mute')]),
            h('td', {}, [
              h('button', { class: 'btn sm', text: a.isActive ? 'غیرفعال' : 'فعال', onclick: function () { api('/admin/admins/' + a.id, { method: 'PUT', body: { isActive: !a.isActive } }).then(function (x) { if (!x.ok) fail(x); draw(); }); } }), ' ',
              h('button', { class: 'btn sm', text: 'رمز تازه', onclick: function () { var pw = prompt('رمز تازه برای ' + a.username + ' (حداقل ۱۰ نویسه):'); if (!pw) return; api('/admin/admins/' + a.id + '/password', { method: 'POST', body: { password: pw } }).then(function (x) { if (!x.ok) fail(x); else toast('رمز عوض شد و نشست‌های قبلی بسته شد'); draw(); }); } })
            ])]);
        }))])]));
    });
  }
  var un = h('input', { type: 'text', dir: 'ltr', placeholder: 'نام کاربری (انگلیسی)', maxlength: 30 }), dn = h('input', { type: 'text', placeholder: 'نام نمایشی', maxlength: 60 }), pw = h('input', { type: 'password', dir: 'ltr', placeholder: 'رمز (حداقل ۱۰ نویسه)', autocomplete: 'new-password' }), role = select(ROLES, 'support');
  root.appendChild(box);
  root.appendChild(card('حساب تازه', 'هر مدیر حساب جدا دارد و کارهایش با اسمش در «گزارش تغییرها» ثبت می‌شود.', [h('div', { class: 'form-grid' }, [field('نام کاربری', un), field('نام نمایشی', dn), field('رمز', pw), field('نقش', role)]),
    h('div', { class: 'toolbar' }, [h('button', { class: 'btn primary', text: 'ساخت حساب', onclick: function () {
      api('/admin/admins', { method: 'POST', body: { username: un.value.trim(), displayName: dn.value.trim() || un.value.trim(), password: pw.value, role: role.value } }).then(function (x) { if (!x.ok) return fail(x); toast('حساب ساخته شد'); un.value = ''; dn.value = ''; pw.value = ''; draw(); });
    } })])]));
  draw();
};
VIEWS.audit = function (root) {
  api('/admin/audit').then(function (r) {
    if (r.status === 404) return root.appendChild(empty('گزارش تغییرها روی این سرور فعال نیست'));
    if (!r.ok) return fail(r);
    root.appendChild(card('گزارش تغییرها', 'صد تغییر آخر', r.body.entries.length ? [h('div', { class: 'tbl-wrap' }, [h('table', {}, [h('thead', {}, [h('tr', {}, ['زمان', 'چه کسی', 'کار', 'هدف', 'جزئیات'].map(function (x) { return h('th', { text: x }); }))]), h('tbody', {}, r.body.entries.map(function (e) { return h('tr', {}, [h('td', { text: ago(e.at) }), h('td', { text: e.actor || '—' }), h('td', {}, [badge(e.action, 'b-info')]), h('td', { class: 'ltr', text: e.target }), h('td', { class: 'ltr', text: e.detail || '' })]); }))])])] : [empty('هنوز چیزی ثبت نشده')]));
  });
};
`;
