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
      refreshCounts();
      if (!r.body.candidates.length) return list.appendChild(empty(status === 'pending' ? 'پیشنهادی برای بررسی نیست. ربات را اجرا کن یا منبع اضافه کن.' : 'موردی نیست'));
      r.body.candidates.forEach(function (c) { list.appendChild(candidateCard(c, load2)); });
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

/* ---------------- level road ---------------- */
VIEWS.levels = function (root) {
  api('/admin/level-road').then(function (r) {
    if (r.status === 404) return root.appendChild(empty('جاده‌ی لول روی این سرور فعال نیست (دیتابیس لازم است)'));
    if (!r.ok) return fail(r);
    var rows = r.body.rows.map(function (x) { return { level: x.level, startXp: x.startXp, rewardCoins: x.rewardCoins, rewardSpins: x.rewardSpins || 0 }; }), custom = r.body.custom;
    var box = h('div'), status = h('div', { class: 'quote' }), xpIn = [], coinIn = [], spinIn = [];
    function read() { return rows.map(function (x, i) { return { level: i + 1, startXp: i === 0 ? 0 : Math.max(0, Math.round(Number(xpIn[i].value) || 0)), rewardCoins: Math.max(0, Math.round(Number(coinIn[i].value) || 0)), rewardSpins: Math.max(0, Math.min(20, Math.round(Number(spinIn[i].value) || 0))) }; }); }
    function total() { return rows.reduce(function (n, x) { return n + x.rewardCoins; }, 0); }
    function draw() {
      clear(box); xpIn = []; coinIn = []; spinIn = [];
      status.textContent = (custom ? 'جدول شما فعال است.' : 'هنوز جدولی ذخیره نشده؛ بازی از فرمول تنظیمات (منحنی XP و جایزه‌ی هر چند لول) استفاده می‌کند. هر عددی را عوض کنی و ذخیره کنی، این جدول جای فرمول را می‌گیرد.') + ' جمع جایزه‌ها: ' + faNum(total()) + ' سکه.';
      var tbl = h('table', { class: 'tbl' });
      tbl.appendChild(h('thead', {}, [h('tr', {}, ['لول', 'XP شروع لول (جمع کل)', 'XP لازم برای این لول', 'جایزه‌ی سکه‌ی رسیدن به این لول', 'چرخش گردونه (پنهان تا به لول برسد)'].map(function (t) { return h('th', { text: t }); }))]));
      var body = h('tbody');
      rows.forEach(function (x, i) {
        var xp = h('input', { type: 'number', min: 0, value: x.startXp, disabled: i === 0 ? 'disabled' : null, style: 'width:140px' }), coin = h('input', { type: 'number', min: 0, max: 1000000, value: x.rewardCoins, style: 'width:140px' });
        var spin = h('input', { type: 'number', min: 0, max: 20, value: x.rewardSpins || 0, style: 'width:90px' }); spin.oninput = function () { x.rewardSpins = Math.max(0, Math.min(20, Math.round(Number(spin.value) || 0))); };
        xpIn.push(xp); coinIn.push(coin); spinIn.push(spin);
        var need = h('span', { text: i === 0 ? '—' : faNum(Math.max(0, x.startXp - rows[i - 1].startXp)) });
        xp.oninput = function () { x.startXp = Math.max(0, Math.round(Number(xp.value) || 0)); need.textContent = i === 0 ? '—' : faNum(Math.max(0, x.startXp - rows[i - 1].startXp)); if (rows[i + 1]) { /* next row's need changes too */ var nx = body.children[i + 1]; if (nx) nx.children[2].textContent = faNum(Math.max(0, rows[i + 1].startXp - x.startXp)); } };
        coin.oninput = function () { x.rewardCoins = Math.max(0, Math.round(Number(coin.value) || 0)); status.textContent = status.textContent.replace(/جمع جایزه‌ها: .*$/, 'جمع جایزه‌ها: ' + faNum(total()) + ' سکه.'); };
        body.appendChild(h('tr', {}, [h('td', { text: fa(x.level) }), h('td', {}, [xp]), h('td', {}, [need]), h('td', {}, [coin]), h('td', {}, [spin])]));
      });
      tbl.appendChild(body);
      box.appendChild(h('div', { style: 'overflow:auto;max-height:60vh' }, [tbl]));
      box.appendChild(h('div', { style: 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap' }, [
        h('button', { class: 'btn', text: '＋ افزودن لول', onclick: function () { rows = read(); var last = rows[rows.length - 1], prev = rows[rows.length - 2]; if (rows.length >= 100) return toast('بیشتر از ۱۰۰ لول نمی‌شود', true); rows.push({ level: rows.length + 1, startXp: last.startXp + Math.max(50, last.startXp - (prev ? prev.startXp : 0) + 100), rewardCoins: 0, rewardSpins: 0 }); draw(); } }),
        h('button', { class: 'btn bad', text: 'حذف آخرین لول', onclick: function () { rows = read(); if (rows.length > 1) rows.pop(); draw(); } }),
        h('button', { class: 'btn', text: 'پر کردن از فرمول تنظیمات', onclick: function () { api('/admin/level-road?defaults=1').then(function (x) { if (!x.ok) return fail(x); rows = x.body.rows; draw(); toast('از فرمول پر شد؛ هنوز ذخیره نشده'); }); } }),
        h('span', { style: 'flex:1' }),
        custom ? h('button', { class: 'btn danger', text: 'بازگشت به فرمول', onclick: function () { if (!confirm('جدول حذف شود و دوباره از فرمول تنظیمات استفاده شود؟')) return; api('/admin/level-road', { method: 'DELETE' }).then(function (x) { if (!x.ok) return fail(x); rows = x.body.rows; custom = false; toast('به فرمول برگشت'); draw(); }); } }) : null,
        h('button', { class: 'btn primary', text: 'ذخیره', onclick: function () { api('/admin/level-road', { method: 'PUT', body: { rows: read() } }).then(function (x) { if (!x.ok) return toast(({ not_increasing: 'XP هر لول باید از لول قبلی بیشتر باشد', first_not_zero: 'لول ۱ باید از صفر شروع شود', reward_too_big: 'جایزه بیش از حد بزرگ است' })[x.body && x.body.error] || 'ذخیره نشد', true); rows = x.body.rows; custom = true; toast('جدول لول‌ها ذخیره شد'); draw(); }); } })
      ]));
    }
    root.appendChild(card('جاده‌ی لول‌ها', 'برای هر لول بگو از چند XP شروع می‌شود و رسیدن به آن چند سکه و چند چرخش گردونه جایزه دارد (۰ = بدون جایزه؛ چرخش‌ها تا رسیدن به آن لول برای بازیکن پنهان‌اند). بازیکن جایزه‌ها را از «جاده‌ی لول‌ها» در اپ می‌گیرد؛ جایزه‌ی لولی که قبلاً گرفته شده دوباره داده نمی‌شود. تعداد ردیف‌ها همان سقف لول است. اینکه هر لول چه چیزی باز می‌کند (کمک، کد دعوت، ...) از «تنظیمات» و «فروشگاه» می‌آید.', [status, box]));
    draw();
  });
};

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
      var gemDelta = h('input', { type: 'number', value: 0, style: 'width:140px' });
      box.appendChild(h('div', { style: 'display:flex;gap:8px;align-items:end' }, [field('تغییر الماس (از طریق دفتر الماس)', gemDelta), h('button', { class: 'btn primary', text: 'اعمال', onclick: function () {
        var d = Number(gemDelta.value); if (!d) return toast('عدد غیرصفر وارد کن', true);
        api('/admin/users/' + id + '/gems', { method: 'POST', body: { delta: d } }).then(function (x) { if (!x.ok) return fail(x); toast('الماس جدید: ' + faNum(x.body.balance)); gemDelta.value = 0; });
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
      var bbox = h('div');
      box.appendChild(h('div', {}, [h('div', { text: 'نشان‌ها، اخطارها و سکوت', style: 'font-weight:700;margin-bottom:6px' }), bbox]));
      Promise.all([api('/admin/users/' + id + '/badges'), api('/admin/badges')]).then(function (rs) {
        clear(bbox);
        if (!rs[0].ok || !rs[1].ok) return bbox.appendChild(empty('این بخش روی سرور فعال نیست'));
        var me = rs[0].body, cat = rs[1].body.badges;
        me.earned.forEach(function (b) { bbox.appendChild(h('div', { class: 'kv' }, [h('span', { text: b.titleFa + (b.perk !== 'none' ? ' · ' + b.perk : '') }), h('button', { class: 'btn bad sm', text: 'پس‌گرفتن', onclick: function () { api('/admin/users/' + id + '/badges/' + b.id, { method: 'DELETE' }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })])); });
        var pick = select(cat.map(function (b) { return [b.id, b.titleFa]; }), cat[0] && cat[0].id);
        bbox.appendChild(h('div', { style: 'display:flex;gap:8px;margin:6px 0' }, [pick, h('button', { class: 'btn', text: 'دادن نشان', onclick: function () { api('/admin/users/' + id + '/badges', { method: 'POST', body: { badgeId: pick.value } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })]));
        me.notices.forEach(function (n) { bbox.appendChild(h('div', { class: 'kv' }, [badge(n.kind === 'warning' ? 'اخطار' : 'تشویق', n.kind === 'warning' ? 'b-bad' : 'b-ok'), h('span', { text: n.text }), h('span', { style: 'color:var(--muted);font-size:12px', text: (n.by === 'agent' ? 'آجان · ' : 'ادمین · ') + ago(n.createdAt) })])); });
        var text = h('input', { type: 'text', placeholder: 'متن اخطار یا تشویق', maxlength: 300 });
        bbox.appendChild(h('div', { style: 'display:flex;gap:8px;margin-top:6px' }, [text,
          h('button', { class: 'btn bad', text: 'اخطار', onclick: function () { api('/admin/users/' + id + '/notices', { method: 'POST', body: { kind: 'warning', text: text.value } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } }),
          h('button', { class: 'btn ok', text: 'تشویق', onclick: function () { api('/admin/users/' + id + '/notices', { method: 'POST', body: { kind: 'commendation', text: text.value } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })]));
        var mins = h('input', { type: 'number', value: 30, min: 1, style: 'width:90px' }), why = h('input', { type: 'text', placeholder: 'دلیل سکوت', maxlength: 200 });
        bbox.appendChild(h('div', { style: 'display:flex;gap:8px;margin-top:6px;align-items:center;flex-wrap:wrap' }, [
          me.muted ? badge('ساکت تا ' + new Date(me.muted.until).toLocaleString('fa-IR'), 'b-warn') : null,
          mins, h('span', { text: 'دقیقه' }), why,
          h('button', { class: 'btn', text: 'سکوت در چت', onclick: function () { api('/admin/users/' + id + '/mute', { method: 'POST', body: { minutes: +mins.value, reason: why.value } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } }),
          me.muted ? h('button', { class: 'btn ok', text: 'برداشتن سکوت', onclick: function () { api('/admin/users/' + id + '/mute', { method: 'DELETE' }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } }) : null]));
      });
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
          h('button', { class: 'btn bad sm', text: 'حذف', onclick: function () { if (!confirm('این کلمه از فیلتر حذف شود؟')) return; api('/admin/words/' + w.id, { method: 'DELETE' }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })
        ]));
      });
    });
  }
  root.appendChild(addCard('افزودن کلمه', 'املا و ریخت‌های مختلف (ی/ي، ک/ك، نیم‌فاصله، حروف تکراری، حروف جداشده) خودکار گرفته می‌شود؛ فقط خود کلمه را بنویس.', 'کلمه‌ی تازه', [['کلمه', word], ['شدت', sev]], function () {
    return api('/admin/words', { method: 'POST', body: { word: word.value.trim(), severity: sev.value } }).then(function (x) { if (x.status === 409) { toast('این کلمه از قبل هست', true); return false; } if (!x.ok) { fail(x); return false; } toast('کلمه اضافه شد'); word.value = ''; draw(); return true; });
  }));
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
  var provinces = [];
  /** Province picker (D101): the badge, colours and greeting the app shows for players of this city. */
  function provSel(cur) {
    var s = h('select', {}, [h('option', { value: '', text: 'بدون استان' })].concat(provinces.map(function (p) { return h('option', { value: p.key, text: (p.abroad ? 'خارج · ' : '') + p.nameFa }); })));
    s.value = cur || '';
    return s;
  }
  var prov = h('select');
  function draw() {
    api('/admin/cities').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('بخش شهرها روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      provinces = r.body.provinces || [];
      var fresh = provSel(prov.value); prov.innerHTML = fresh.innerHTML; prov.value = fresh.value;
      r.body.cities.forEach(function (c) {
        var ps = provSel(c.province);
        ps.onchange = function () { api('/admin/cities/' + c.id, { method: 'PATCH', body: { province: ps.value || null } }).then(function (x) { if (!x.ok) return fail(x); toast('استان ' + c.nameFa + ' ذخیره شد'); }); };
        list.appendChild(h('span', { class: 'chip', style: 'display:inline-flex;gap:6px;align-items:center' }, [
          h('span', { text: c.nameFa }), ps, c.isActive ? null : badge('پنهان', 'b-warn'),
          h('button', { class: 'btn sm', text: c.isActive ? 'پنهان کن' : 'نشان بده', onclick: function () { api('/admin/cities/' + c.id, { method: 'PATCH', body: { isActive: !c.isActive } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })
        ]));
      });
    });
  }
  root.appendChild(addCard('افزودن شهر', 'بازیکن‌ها شهرشان را از این فهرست انتخاب می‌کنند؛ پنهان‌کردن، شهرِ کسانی که قبلاً انتخاب کرده‌اند را عوض نمی‌کند.', 'شهر تازه', [['شناسه (انگلیسی)', slug], ['نام شهر', name], ['استان', prov]], function () {
    return api('/admin/cities', { method: 'POST', body: { slug: slug.value.trim(), nameFa: name.value.trim(), province: prov.value || null } }).then(function (x) { if (x.status === 409) { toast('این شناسه از قبل هست', true); return false; } if (!x.ok) { fail(x); return false; } toast('شهر اضافه شد'); slug.value = ''; name.value = ''; draw(); return true; });
  }));
  root.appendChild(card('فهرست شهرها', null, [list]));
  draw();
};
VIEWS.dailypuzzle = function (root) {
  var KINDS = { occasion: 'مناسبت', season: 'فصل', trend: 'ترند', category: 'دسته', custom: 'دلخواه' };
  var MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  var themesBox = h('div'), schedBox = h('div');
  var puzzles = [], themes = [];
  function pname(id) { var p = puzzles.filter(function (x) { return x.id === id; })[0]; return p ? p.titles.join('، ') : (id ? id.slice(0, 8) : '—'); }
  function tname(id) { var t = themes.filter(function (x) { return x.id === id; })[0]; return t ? t.titleFa : ''; }
  function win(t) {
    var out = [];
    if (t.startMonth) out.push('هر سال ' + fa(t.startDay) + ' ' + MONTHS[t.startMonth - 1] + ' تا ' + fa(t.endDay) + ' ' + MONTHS[t.endMonth - 1]);
    if (t.fromDate || t.toDate) out.push((t.fromDate || '…') + ' تا ' + (t.toDate || '…'));
    return out.length ? out.join(' و ') : 'همه‌ی روزها';
  }
  function linkPanel(t, box) {
    api('/admin/daily-puzzle/themes/' + t.id + '/puzzles').then(function (r) {
      if (!r.ok) return fail(r);
      var on = {}; r.body.puzzleIds.forEach(function (id) { on[id] = true; });
      clear(box);
      if (!puzzles.length) return box.appendChild(empty('پازل تأییدشده‌ای نیست'));
      puzzles.forEach(function (p) {
        var cb = h('input', { type: 'checkbox' }); cb.checked = !!on[p.id];
        cb.onchange = function () { api('/admin/daily-puzzle/themes/' + t.id + '/puzzles/' + p.id, { method: cb.checked ? 'POST' : 'DELETE' }).then(function (x) { if (!x.ok) { cb.checked = !cb.checked; return fail(x); } drawThemes(); }); };
        box.appendChild(h('label', { style: 'display:block;padding:2px 0' }, [cb, ' ' + p.titles.join('، ')]));
      });
    });
  }
  function drawThemes() {
    api('/admin/daily-puzzle/themes').then(function (r) {
      clear(themesBox);
      if (r.status === 404) return themesBox.appendChild(empty('بخش پازل روز روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      themes = r.body.themes;
      if (!themes.length) themesBox.appendChild(empty('هنوز موضوعی نیست؛ بدون موضوع هر روز یک پازل تصادفی (که اخیراً نبوده) انتخاب می‌شود'));
      themes.forEach(function (t) {
        var panel = h('div', { style: 'display:none;max-height:240px;overflow:auto;margin-top:6px' });
        themesBox.appendChild(h('div', { class: 'card-row', style: 'padding:8px 0;border-bottom:1px solid var(--line)' }, [
          h('div', {}, [h('b', { text: t.titleFa }), ' ', badge(KINDS[t.kind], 'b-info'), ' ', t.isActive ? null : badge('خاموش', 'b-warn'), ' ', h('span', { class: 'muted', text: win(t) + ' · وزن ' + fa(t.weight) + ' · ' + fa(t.puzzles) + ' پازل' })]),
          h('div', { class: 'toolbar' }, [
            h('button', { class: 'btn sm', text: 'پازل‌ها', onclick: function () { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; if (panel.style.display === 'block') linkPanel(t, panel); } }),
            h('button', { class: 'btn sm', text: t.isActive ? 'خاموش کن' : 'روشن کن', onclick: function () {
              api('/admin/daily-puzzle/themes/' + t.id, { method: 'PATCH', body: { titleFa: t.titleFa, kind: t.kind, weight: t.weight, startMonth: t.startMonth, startDay: t.startDay, endMonth: t.endMonth, endDay: t.endDay, fromDate: t.fromDate, toDate: t.toDate, isActive: !t.isActive } }).then(function (x) { if (!x.ok) return fail(x); drawThemes(); drawSched(); });
            } }),
            h('button', { class: 'btn sm danger', text: 'حذف', onclick: function () { if (!confirm('این موضوع حذف شود؟')) return; api('/admin/daily-puzzle/themes/' + t.id, { method: 'DELETE' }).then(function (x) { if (!x.ok) return fail(x); drawThemes(); drawSched(); }); } })
          ]),
          panel
        ]));
      });
      drawSched();
    });
  }
  function drawSched() {
    api('/admin/daily-puzzle/schedule?days=14').then(function (r) {
      clear(schedBox);
      if (!r.ok) return fail(r);
      var rows = r.body.days.map(function (d) {
        var sel = h('select', {}, [h('option', { value: '', text: 'یک پازل را ثابت کن…' })].concat(puzzles.map(function (p) { return h('option', { value: p.id, text: p.titles.join('، ') }); })));
        var kind = d.pinnedBy === 'admin' ? badge('دستی', 'b-ok') : d.pinnedBy === 'auto' ? badge('انتخاب‌شده', 'b-info') : badge('پیش‌نمایش', 'b-warn');
        return h('tr', {}, [
          h('td', { class: 'ltr', text: d.dateKey }), h('td', { text: d.puzzleId ? pname(d.puzzleId) : 'پازلی نیست' }), h('td', { text: d.themeId ? tname(d.themeId) : '—' }), h('td', {}, [kind]),
          h('td', {}, [h('div', { class: 'toolbar' }, [sel,
            h('button', { class: 'btn sm', text: 'ثابت', onclick: function () { if (!sel.value) return; api('/admin/daily-puzzle/days/' + d.dateKey, { method: 'PUT', body: { puzzleId: sel.value, themeId: null } }).then(function (x) { if (x.status === 409) return toast('کسی این روز را بازی کرده', true); if (!x.ok) return fail(x); drawSched(); }); } }),
            d.pinnedBy === 'preview' ? null : h('button', { class: 'btn sm', text: 'برداشتن', onclick: function () { api('/admin/daily-puzzle/days/' + d.dateKey, { method: 'DELETE' }).then(function (x) { if (x.status === 409) return toast('کسی این روز را بازی کرده', true); if (!x.ok) return fail(x); drawSched(); }); } })
          ])])
        ]);
      });
      schedBox.appendChild(h('div', { class: 'tbl-wrap' }, [h('table', {}, [h('thead', {}, [h('tr', {}, ['روز', 'پازل', 'موضوع', 'وضعیت', ''].map(function (x) { return h('th', { text: x }); }))]), h('tbody', {}, rows)])]));
    });
  }
  var title = h('input', { type: 'text', placeholder: 'عنوان (مثلاً «نوروز» یا «گرانی بنزین»)', maxlength: 80 });
  var kind = h('select', {}, Object.keys(KINDS).map(function (k) { return h('option', { value: k, text: KINDS[k] }); }));
  var weight = h('input', { type: 'number', value: 1, min: 1, max: 100, style: 'width:70px' });
  function sel12(v) { return h('select', {}, [h('option', { value: '', text: '—' })].concat(MONTHS.map(function (m, i) { return h('option', { value: i + 1, text: m }); }))); }
  var sm = sel12(), em = sel12();
  var sd = h('input', { type: 'number', min: 1, max: 31, placeholder: 'روز', style: 'width:70px' }), ed = h('input', { type: 'number', min: 1, max: 31, placeholder: 'روز', style: 'width:70px' });
  var from = h('input', { type: 'text', dir: 'ltr', placeholder: 'از 2026-03-01', maxlength: 10, style: 'width:130px' }), to = h('input', { type: 'text', dir: 'ltr', placeholder: 'تا 2026-03-31', maxlength: 10, style: 'width:130px' });
  root.appendChild(addCard('موضوع تازه', 'موضوع یعنی دلیلِ انتخاب پازل: مناسبت، فصل، ترند یا دسته. در روزهای بازه‌اش پازل‌های وصل‌شده به آن اولویت دارند. بازه‌ی سالانه به تاریخ شمسی است؛ بازه‌ی مطلق برای ترند یک‌باره.', 'موضوع تازه', [
    ['عنوان', title], ['نوع', kind], ['وزن', weight],
    h('div', { class: 'toolbar' }, [h('span', { text: 'هر سال از' }), sm, sd, h('span', { text: 'تا' }), em, ed]),
    h('div', { class: 'toolbar' }, [from, to])
  ], function () {
    var rec = sm.value && sd.value && em.value && ed.value;
    if ((sm.value || sd.value || em.value || ed.value) && !rec) { toast('بازه‌ی سالانه را کامل پر کن', true); return false; }
    return api('/admin/daily-puzzle/themes', { method: 'POST', body: { titleFa: title.value.trim(), kind: kind.value, weight: +weight.value || 1, startMonth: rec ? +sm.value : null, startDay: rec ? +sd.value : null, endMonth: rec ? +em.value : null, endDay: rec ? +ed.value : null, fromDate: from.value.trim() || null, toDate: to.value.trim() || null, isActive: true } }).then(function (x) { if (!x.ok) { fail(x); return false; } toast('موضوع ساخته شد'); title.value = ''; drawThemes(); return true; });
  }));
  root.appendChild(card('موضوع‌ها', null, [themesBox]));
  root.appendChild(card('برنامه‌ی ۱۴ روز آینده', 'روزهای «پیش‌نمایش» هنوز ثبت نشده‌اند و هنگام اولین نیاز همین‌طور انتخاب می‌شوند. «ثابت» یک پازل را برای آن روز قطعی می‌کند (تا وقتی کسی بازی نکرده).', [schedBox]));
  api('/admin/daily-puzzle/puzzles').then(function (r) { if (r.ok) puzzles = r.body.puzzles; drawThemes(); });
};
VIEWS.shop = function (root) {
  var list = h('div');
  function num(v, min) { return h('input', { type: 'number', value: v, min: min === undefined ? 0 : min, style: 'width:90px' }); }
  function txt(v, ph) { return h('input', { type: 'text', value: v || '', placeholder: ph || '', maxlength: 80, style: 'width:130px' }); }
  function row(it) {
    var toman = num(Math.floor((it.priceRials || 0) / 10)), skuB = txt(it.skuBazaar, 'SKU بازار'), skuM = txt(it.skuMyket, 'SKU مایکت');
    var cur = select([['coins', 'سکه'], ['gems', 'الماس']], it.currency || 'coins'), price = num(it.currency === 'gems' ? it.priceGems : it.priceCoins), lvl = num(it.minLevel, 1), lim = num(it.perDayLimit), amt = num(it.amount, 1);
    function save(patch) { api('/admin/shop/' + it.id, { method: 'PATCH', body: patch }).then(function (x) { if (!x.ok) return fail(x); toast('ذخیره شد'); draw(); }); }
    return h('div', { class: 'card', style: 'padding:12px' }, [
      h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
        h('b', { text: it.titleFa }), it.isActive ? badge('فعال', 'b-ok') : badge('پنهان', 'b-warn'), h('span', { class: 'h', text: it.descriptionFa })
      ]),
      h('div', { class: 'toolbar', style: 'margin-top:8px' }, [
        field('پرداخت با', cur), field('قیمت', price), field('قیمت پول واقعی (تومان، ۰ = بدون)', toman), field('SKU بازار', skuB), field('SKU مایکت', skuM), field('تعداد در هر خرید', amt), field('کمترین لول', lvl), field('سقف خرید در روز (۰ = بی‌سقف)', lim),
        h('button', { class: 'btn primary', text: 'ذخیره', onclick: function () { save({ priceRials: +toman.value * 10, skuBazaar: skuB.value.trim() || null, skuMyket: skuM.value.trim() || null, currency: cur.value, priceCoins: cur.value === 'coins' ? +price.value : it.priceCoins, priceGems: cur.value === 'gems' ? +price.value : it.priceGems, amount: +amt.value, minLevel: +lvl.value, perDayLimit: +lim.value }); } }),
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
  var tomanNew = num(0), skuBN = h('input', { type: 'text', placeholder: 'SKU بازار', maxlength: 80 }), skuMN = h('input', { type: 'text', placeholder: 'SKU مایکت', maxlength: 80 });
  var cur = select([['coins', 'سکه'], ['gems', 'الماس']], 'coins'), price = num(20), amt = num(1, 1), lvl = num(1, 1), lim = num(0), eff = select([['hint_token', 'توکن راهنما'], ['wheel_spin', 'چرخش گردونه'], ['cosmetic', 'لباس / کلاه']], 'hint_token'), slot = select([['hat', 'کلاه'], ['outfit', 'لباس'], ['accessory', 'زیورآلات']], 'hat'), icon = h('input', { type: 'text', placeholder: 'magnifier، hat، crown، shirt …', value: 'magnifier', maxlength: 30 });
  root.appendChild(card('قیمت راهنما در بازی تکی', 'قیمت هر راهنما، لول لازم و سقف راهنما در هر بازی در بخش «تنظیمات ← اقتصاد» است.', []));
  root.appendChild(card('آیتم‌های فروشگاه', 'هر آیتم با سکه یا الماس خریده می‌شود و «توکن راهنما» می‌دهد؛ توکن به جای سکه در بازی تکی خرج می‌شود. بازیکن شرط لول و سقف روزانه را قبل از خرید می‌بیند.', [list]));
  root.appendChild(addCard('آیتم تازه', 'نوع اثر: «توکن راهنما» (به جای سکه در بازی تکی خرج می‌شود) یا «چرخش گردونه» (هر عدد یک چرخش گردونه‌ی شانس) یا «لباس / کلاه» (یک بار خریده می‌شود و روی آواتار پوشیده می‌شود؛ تعداد را ۱ بگذارید).', 'آیتم تازه', [['عنوان', title], ['توضیح', desc], ['نوع اثر', eff], ['جایگاه (فقط لباس / کلاه)', slot], ['نام آیکن', icon], ['پرداخت با', cur], ['قیمت (به واحد انتخابی)', price], ['قیمت پول واقعی (تومان، ۰ = بدون)', tomanNew], ['SKU بازار (اختیاری)', skuBN], ['SKU مایکت (اختیاری)', skuMN], ['تعداد (توکن یا چرخش)', amt], ['کمترین لول', lvl], ['سقف در روز', lim]], function () {
    return api('/admin/shop', { method: 'POST', body: { titleFa: title.value.trim(), descriptionFa: desc.value.trim(), effect: eff.value, amount: +amt.value, priceRials: +tomanNew.value * 10, skuBazaar: skuBN.value.trim() || null, skuMyket: skuMN.value.trim() || null, currency: cur.value, priceCoins: cur.value === 'coins' ? +price.value : 0, priceGems: cur.value === 'gems' ? +price.value : 0, minLevel: +lvl.value, perDayLimit: +lim.value, slot: eff.value === 'cosmetic' ? slot.value : null, iconKey: eff.value === 'wheel_spin' ? 'dice' : icon.value.trim() || 'magnifier', isActive: true } }).then(function (x) { if (!x.ok) { fail(x); return false; } toast('آیتم ساخته شد'); title.value = ''; desc.value = ''; draw(); return true; });
  }));
  draw();
};
VIEWS.wheel = function (root) {
  var KIND = { coins: 'سکه', gems: 'الماس', hint_token: 'توکن راهنما', wheel_spin: 'چرخش گردونه', cosmetic: 'لباس / کلاه' };
  var KINDS = [['coins', 'سکه'], ['gems', 'الماس'], ['hint_token', 'توکن راهنما'], ['wheel_spin', 'چرخش گردونه'], ['cosmetic', 'لباس / کلاه (آیتم فروشگاه)']];
  var itemSel = select([['', '— آیتم لباس —']], '');
  var list = h('div'), odds = h('div', { class: 'h' });
  function num(v, min) { return h('input', { type: 'number', value: v, min: min === undefined ? 0 : min, style: 'width:90px' }); }
  function row(p, total) {
    var amt = num(p.amount, 1), w = num(p.weight);
    function save(patch) { api('/admin/wheel/prizes/' + p.id, { method: 'PATCH', body: patch }).then(function (x) { if (!x.ok) return fail(x); toast('ذخیره شد'); draw(); }); }
    var pct = total > 0 && p.isActive ? Math.round((1000 * p.weight) / total) / 10 : 0;
    return h('div', { class: 'card', style: 'padding:12px' }, [
      h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
        h('b', { text: (KIND[p.kind] || p.kind) + (p.titleFa ? ' · ' + p.titleFa : '') }), p.isActive ? badge('فعال', 'b-ok') : badge('پنهان', 'b-warn'), h('span', { class: 'h', text: 'شانس تقریبی ' + faNum(pct) + '٪' })
      ]),
      h('div', { class: 'toolbar', style: 'margin-top:8px' }, [
        field('مقدار', amt), field('وزن شانس (۰ = هیچ‌وقت)', w),
        h('button', { class: 'btn primary', text: 'ذخیره', onclick: function () { save({ amount: +amt.value, weight: +w.value }); } }),
        h('button', { class: 'btn', text: p.isActive ? 'پنهان کن' : 'فعال کن', onclick: function () { save({ isActive: !p.isActive }); } })
      ])
    ]);
  }
  function draw() {
    api('/admin/wheel/prizes').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('گردونه روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      var total = 0;
      r.body.prizes.forEach(function (p) { if (p.isActive) total += p.weight; });
      var coins = 0;
      r.body.prizes.forEach(function (p) { if (p.isActive && p.kind === 'coins' && total > 0) coins += (p.amount * p.weight) / total; });
      odds.textContent = 'میانگین سکه‌ی هر چرخش (بدون مقیاس): ' + faNum(Math.round(coins * 10) / 10) + ' · قطعه‌ی بدون شانس روی گردونه دیده نمی‌شود.';
      r.body.prizes.forEach(function (p) { list.appendChild(row(p, total)); });
    });
  }
  var kind = select(KINDS, 'coins'), amt = num(10, 1), wt = num(10);
  root.appendChild(card('جایزه‌های گردونه', 'هر ردیف یک قطعه‌ی گردونه است. شانس هر قطعه = وزنش تقسیم بر جمع وزن‌های فعال. چرخش رایگان و چرخش بعد از برد در «تنظیمات ← اقتصاد» است.', [odds, list]));
  root.appendChild(addCard('قطعه‌ی تازه', 'نوع جایزه، مقدارش و وزن شانس را بنویسید.', 'قطعه‌ی تازه', [['نوع جایزه', kind], ['آیتم (فقط برای لباس / کلاه)', itemSel], ['مقدار (برای لباس ۱)', amt], ['وزن شانس', wt]], function () {
    return api('/admin/wheel/prizes', { method: 'POST', body: { kind: kind.value, itemId: kind.value === 'cosmetic' ? itemSel.value || null : null, amount: kind.value === 'cosmetic' ? 1 : +amt.value, weight: +wt.value, isActive: true } }).then(function (x) { if (!x.ok) { fail(x); return false; } toast('قطعه ساخته شد'); draw(); return true; });
  }));
  api('/admin/shop').then(function (r) { if (!r.ok) return; r.body.items.filter(function (i) { return i.effect === 'cosmetic'; }).forEach(function (i) { itemSel.appendChild(h('option', { value: i.id, text: i.titleFa })); }); });
  draw();
};
VIEWS.shortlinks = function (root) {
  var list = h('div'), baseUrl = '';
  var ERR = { invalid_url: 'آدرس مقصد درست نیست (باید با http یا https شروع شود).', invalid_code: 'کد فقط حرف کوچک انگلیسی، عدد، خط تیره و زیرخط باشد (۲ تا ۲۴ نویسه).', reserved: 'این کد برای سیستم رزرو است.', taken: 'این کد قبلاً استفاده شده.', self_link: 'مقصد نباید خود دامنه‌ی کوتاه باشد.' };
  function row(l) {
    var full = baseUrl ? baseUrl + '/' + l.code : '/s/' + l.code;
    function save(patch) { api('/admin/short-links/' + l.code, { method: 'PATCH', body: patch }).then(function (x) { if (!x.ok) return fail(x); toast('ذخیره شد'); draw(); }); }
    var target = h('input', { type: 'text', value: l.targetUrl, style: 'min-width:260px;flex:1' });
    return h('div', { class: 'card', style: 'padding:12px' }, [
      h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
        h('b', { text: full, style: 'direction:ltr' }), l.isActive ? badge('فعال', 'b-ok') : badge('خاموش', 'b-warn'), h('span', { class: 'h', text: faNum(l.clicks) + ' کلیک' + (l.note ? ' · ' + l.note : '') })
      ]),
      h('div', { class: 'toolbar', style: 'margin-top:8px' }, [
        field('مقصد', target),
        h('button', { class: 'btn primary', text: 'ذخیره', onclick: function () { save({ url: target.value }); } }),
        h('button', { class: 'btn', text: l.isActive ? 'خاموش کن' : 'روشن کن', onclick: function () { save({ isActive: !l.isActive }); } })
      ])
    ]);
  }
  function draw() {
    api('/admin/short-links').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('لینک کوتاه روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      baseUrl = r.body.base;
      if (!baseUrl) list.appendChild(h('div', { class: 'h', text: 'دامنه‌ی لینک کوتاه در «تنظیمات ← اپ» خالی است؛ تا آن را پر نکنید لینک‌ها فقط با /s/کد کار می‌کنند.' }));
      if (r.body.links.length === 0) list.appendChild(empty('هنوز لینکی نساخته‌اید'));
      r.body.links.forEach(function (l) { list.appendChild(row(l)); });
    });
  }
  var url = h('input', { type: 'text', placeholder: 'https://…', style: 'direction:ltr' }), code = h('input', { type: 'text', placeholder: 'خالی = خودکار', maxlength: 24, style: 'direction:ltr' }), note = h('input', { type: 'text', placeholder: 'یادداشت (اختیاری)', maxlength: 120 });
  root.appendChild(card('لینک‌های کوتاه', 'هر لینک بعد از دامنه‌ی کوتاه می‌آید؛ مثلاً 2oi.ir/dl. تغییر مقصد فوری اثر می‌کند.', [list]));
  root.appendChild(addCard('لینک تازه', 'آدرس کامل مقصد را بنویسید؛ کد دلخواه اختیاری است.', 'لینک تازه', [['مقصد', url], ['کد دلخواه', code], ['یادداشت', note]], function () {
    return api('/admin/short-links', { method: 'POST', body: { url: url.value.trim(), code: code.value.trim() || undefined, note: note.value.trim() } }).then(function (x) { if (!x.ok) { toast(ERR[x.body && x.body.error] || 'نشد'); return false; } toast('ساخته شد: ' + x.body.code); url.value = ''; code.value = ''; note.value = ''; draw(); return true; });
  }));
  draw();
};
var LANDING_ERR = { slug_taken: 'این نشانی (slug) قبلاً برای مقاله‌ی دیگری استفاده شده.', invalid_slug: 'نشانی فقط حرف، عدد و خط تیره باشد (حداقل ۲ نویسه).', invalid_cover: 'آدرس تصویر باید با http یا https شروع شود.', empty: 'عنوان و متن مقاله لازم است.' };
function postFields(p) {
  p = p || {};
  var f = {
    title: h('input', { type: 'text', value: p.titleFa || '', maxlength: 160 }),
    slug: h('input', { type: 'text', value: p.slug || '', placeholder: 'خالی = از عنوان ساخته می‌شود', maxlength: 120, style: 'direction:ltr' }),
    summary: h('textarea', { rows: 2, maxlength: 400, text: p.summaryFa || '' }),
    body: h('textarea', { rows: 14, style: 'width:100%;font-family:monospace;direction:rtl', text: p.bodyMd || '' }),
    metaTitle: h('input', { type: 'text', value: p.metaTitle || '', maxlength: 70, placeholder: 'خالی = همان عنوان' }),
    metaDesc: h('textarea', { rows: 2, maxlength: 200, text: p.metaDescription || '' }),
    cover: h('input', { type: 'text', value: p.coverUrl || '', placeholder: 'https://…', style: 'direction:ltr' }),
    author: h('input', { type: 'text', value: p.authorName || '', maxlength: 80 }),
    status: select([['draft', 'پیش‌نویس (منتشر نشده)'], ['published', 'منتشر شده']], p.status || 'draft')
  };
  f.nodes = [['عنوان', f.title], ['نشانی (slug)', f.slug, 'تغییر نشانی یک مقاله‌ی منتشرشده خودکار ۳۰۱ می‌شود.'], ['خلاصه', f.summary, 'یکی دو جمله؛ در فهرست و نتیجه‌ی جستجو دیده می‌شود.'], ['متن (مارک‌داون)', f.body, 'با ## بخش بسازید؛ زیر هر ## جمله‌ی اول پاسخ مستقیم باشد.'], ['عنوان گوگل', f.metaTitle], ['توضیح گوگل', f.metaDesc, 'حداکثر ۱۶۰ نویسه.'], ['تصویر شاخص', f.cover], ['نویسنده', f.author], ['وضعیت', f.status]];
  f.value = function () { return { titleFa: f.title.value.trim(), slug: f.slug.value.trim() || undefined, summaryFa: f.summary.value.trim(), bodyMd: f.body.value, metaTitle: f.metaTitle.value.trim() || null, metaDescription: f.metaDesc.value.trim() || null, coverUrl: f.cover.value.trim() || null, authorName: f.author.value.trim(), status: f.status.value }; };
  return f;
}
VIEWS.landingposts = function (root) {
  var list = h('div');
  function edit(id) {
    api('/admin/landing/posts/' + id).then(function (r) {
      if (!r.ok) return fail(r);
      var f = postFields(r.body);
      modal('ویرایش مقاله', h('div', { class: 'form-grid' }, f.nodes.map(function (n) { return field(n[0], n[1], n[2]); })), [{ label: 'انصراف' }, { label: 'ذخیره', cls: 'primary', keepOpen: true, run: function (close) {
        api('/admin/landing/posts/' + id, { method: 'PUT', body: f.value() }).then(function (x) { if (!x.ok) return toast(LANDING_ERR[x.body && x.body.error] || 'نشد', true); toast('ذخیره شد'); close(); draw(); });
      } }]);
    });
  }
  function draw() {
    api('/admin/landing/posts').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('سایت معرفی روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      if (r.body.posts.length === 0) list.appendChild(empty('هنوز مقاله‌ای ننوشته‌اید'));
      r.body.posts.forEach(function (p) {
        list.appendChild(h('div', { class: 'card', style: 'padding:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
          h('b', { text: p.titleFa }), p.status === 'published' ? badge('منتشر شده', 'b-ok') : badge('پیش‌نویس', 'b-warn'), h('span', { class: 'h', text: '/blog/' + p.slug, style: 'direction:ltr' }),
          h('button', { class: 'btn', text: 'ویرایش', onclick: function () { edit(p.id); } })
        ]));
      });
    });
  }
  var fresh = postFields(null);
  root.appendChild(card('مقاله‌ها', 'فقط مقاله‌های «منتشر شده» در سایت معرفی، نقشه‌ی سایت و llms.txt دیده می‌شوند.', [list]));
  root.appendChild(addCard('مقاله‌ی تازه', 'مارک‌داون بنویسید؛ HTML خام حذف می‌شود.', 'مقاله‌ی تازه', fresh.nodes, function () {
    return api('/admin/landing/posts', { method: 'POST', body: fresh.value() }).then(function (x) { if (!x.ok) { toast(LANDING_ERR[x.body && x.body.error] || 'نشد', true); return false; } toast('ساخته شد'); draw(); return true; });
  }));
  draw();
};
function simpleList(root, o) {
  var list = h('div');
  function draw() {
    api(o.path).then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('سایت معرفی روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      var rows = r.body[o.key];
      if (rows.length === 0) list.appendChild(empty(o.none));
      rows.forEach(function (it) {
        var inputs = o.edit.map(function (e) { return h(e.tag || 'input', e.tag ? { rows: 3, text: it[e.k] || '' } : { type: 'text', value: it[e.k] || '' }); });
        list.appendChild(h('div', { class: 'card', style: 'padding:12px' }, [
          h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [h('b', { text: it[o.title] }), it.isActive ? badge('فعال', 'b-ok') : badge('پنهان', 'b-warn')]),
          h('div', { class: 'form-grid', style: 'margin-top:8px' }, o.edit.map(function (e, i) { return field(e.label, inputs[i]); })),
          h('div', { class: 'toolbar', style: 'margin-top:8px' }, [
            h('button', { class: 'btn primary', text: 'ذخیره', onclick: function () { var body = {}; o.edit.forEach(function (e, i) { body[e.k] = inputs[i].value; }); api(o.path + '/' + it.id, { method: 'PATCH', body: body }).then(function (x) { if (!x.ok) return fail(x); toast('ذخیره شد'); draw(); }); } }),
            h('button', { class: 'btn', text: it.isActive ? 'پنهان کن' : 'فعال کن', onclick: function () { api(o.path + '/' + it.id, { method: 'PATCH', body: { isActive: !it.isActive } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } }),
            h('button', { class: 'btn', text: 'بالاتر', onclick: function () { api(o.path + '/' + it.id, { method: 'PATCH', body: { sortOrder: Math.max(0, it.sortOrder - 1) } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })
          ])
        ]));
      });
    });
  }
  var inputs = o.edit.map(function (e) { return h(e.tag || 'input', e.tag ? { rows: 3 } : { type: 'text' }); });
  root.appendChild(card(o.heading, o.sub, [list]));
  root.appendChild(addCard(o.addTitle, o.addSub, o.addTitle, o.edit.map(function (e, i) { return [e.label, inputs[i]]; }), function () {
    var body = { isActive: true }; o.edit.forEach(function (e, i) { body[e.k] = inputs[i].value.trim(); });
    return api(o.path, { method: 'POST', body: body }).then(function (x) { if (!x.ok) { fail(x); return false; } toast('ساخته شد'); inputs.forEach(function (i) { i.value = ''; }); draw(); return true; });
  }));
  draw();
}
VIEWS.landingcast = function (root) {
  simpleList(root, { path: '/admin/landing/cast', key: 'cast', title: 'nameFa', none: 'هنوز کسی اضافه نشده', heading: 'بازیگران', sub: 'ترتیب نمایش با «بالاتر» عوض می‌شود. «تصویر» نام شخصیت (dozari، dozariF …) یا آدرس تصویر است.', addTitle: 'بازیگر تازه', addSub: 'نام، نقش و یک معرفی کوتاه.',
    edit: [{ k: 'nameFa', label: 'نام' }, { k: 'roleFa', label: 'نقش' }, { k: 'bioFa', label: 'معرفی', tag: 'textarea' }, { k: 'imageKey', label: 'تصویر' }] });
};
VIEWS.landingfaq = function (root) {
  simpleList(root, { path: '/admin/landing/faq', key: 'faq', title: 'questionFa', none: 'هنوز پرسشی نیست', heading: 'پرسش‌های متداول', sub: 'جواب را با یک جمله‌ی مستقیم شروع کنید؛ هر دو، گوگل و دستیارهای هوش مصنوعی، همین را نقل می‌کنند.', addTitle: 'پرسش تازه', addSub: 'پرسش و پاسخ کوتاه.',
    edit: [{ k: 'questionFa', label: 'پرسش' }, { k: 'answerFa', label: 'پاسخ', tag: 'textarea' }] });
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
  var code = h('input', { type: 'text', dir: 'ltr', placeholder: 'کد (مثل NAVRUZ)', maxlength: 12 }), label = h('input', { type: 'text', placeholder: 'نام کمپین (اختیاری)', maxlength: 80 }), uses = h('input', { type: 'number', value: 100, min: 1, style: 'width:110px' });
  root.appendChild(addCard('کد معرف ویژه (کمپین)', 'کد کمپین معرفی ندارد، پس پاداش معرف پرداخت نمی‌شود؛ فقط دعوت‌شده سکه‌ی خوش‌آمد و فعال‌شدن حساب را می‌گیرد. حروف و عددهای شبیه به هم (۰ O ۱ I L) مجاز نیستند.', 'کد تازه', [['کد', code, '۴ تا ۱۲ حرف یا عدد، مثل NAVRUZ'], ['نام کمپین', label, 'اختیاری'], ['تعداد استفاده', uses]], function () {
    return api('/admin/invites', { method: 'POST', body: { code: code.value, label: label.value.trim() || code.value.trim(), maxUses: +uses.value } }).then(function (x) { if (x.status === 409) { toast('این کد از قبل هست', true); return false; } if (!x.ok) { fail(x); return false; } toast('کد ساخته شد'); code.value = ''; label.value = ''; draw(); return true; });
  }));
  root.appendChild(card('همه‌ی کدها', 'سقف استفاده‌ی کد شخصی و پاداش‌ها در «تنظیمات ← اقتصاد» است. غیرفعال‌کردن یک کد جلوی دعوت تازه را می‌گیرد، حساب‌های دعوت‌شده‌ی قبلی بدون تغییر می‌مانند.', [list]));
  draw();
};
VIEWS.badges = function (root) {
  var list = h('div');
  function num(v) { return h('input', { type: 'number', value: v, min: 0, style: 'width:90px' }); }
  var PERKS = [['none', 'بدون امتیاز'], ['share_contact', 'مجاز به فرستادن شماره/لینک در چت'], ['moderator', 'آجان دوزاری (اخطار و سکوت)']];
  var METRICS = [['none', 'فقط ادمین می‌دهد'], ['games', 'تعداد بازی'], ['wins', 'تعداد برد'], ['level', 'لول']];
  function row(b) {
    var title = h('input', { type: 'text', value: b.titleFa, maxlength: 60 }), desc = h('input', { type: 'text', value: b.descriptionFa, maxlength: 200 });
    var perk = select(PERKS, b.perk), metric = select(METRICS, b.ruleMetric), min = num(b.ruleMin);
    function save(patch) { api('/admin/badges/' + b.id, { method: 'PATCH', body: patch }).then(function (x) { if (!x.ok) return fail(x); toast('ذخیره شد'); draw(); }); }
    return h('div', { class: 'card', style: 'padding:12px' }, [
      h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [h('b', { text: b.slug, class: 'ltr' }), badge(b.kind === 'medal' ? 'مدال' : 'نشان', 'b-ok'), b.isActive ? null : badge('غیرفعال', 'b-warn')]),
      h('div', { class: 'toolbar', style: 'margin-top:8px' }, [field('نام', title), field('توضیح', desc)]),
      h('div', { class: 'toolbar' }, [field('امتیاز', perk), field('شرط خودکار', metric), field('حداقل', min),
        h('button', { class: 'btn primary', text: 'ذخیره', onclick: function () { save({ titleFa: title.value.trim(), descriptionFa: desc.value.trim(), perk: perk.value, ruleMetric: metric.value, ruleMin: +min.value }); } }),
        h('button', { class: 'btn', text: b.isActive ? 'غیرفعال کن' : 'فعال کن', onclick: function () { save({ isActive: !b.isActive }); } })])
    ]);
  }
  function draw() {
    api('/admin/badges').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('نشان‌ها روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      r.body.badges.forEach(function (b) { list.appendChild(row(b)); });
    });
  }
  var slug = h('input', { type: 'text', dir: 'ltr', placeholder: 'شناسه‌ی لاتین', maxlength: 40 }), title = h('input', { type: 'text', placeholder: 'نام', maxlength: 60 }), desc = h('input', { type: 'text', placeholder: 'توضیح', maxlength: 200 });
  var kind = select([['badge', 'نشان'], ['medal', 'مدال']], 'badge'), perk = select(PERKS, 'none'), metric = select(METRICS, 'games'), min = num(10);
  root.appendChild(card('نشان‌ها و مدال‌ها', 'نشان می‌تواند امتیاز داشته باشد (فرستادن شماره/لینک در چت، یا نقش آجان دوزاری) و شرط خودکار (مثلاً لول ۱۰). بازیکن شرط نشان‌های قفل را می‌بیند.', [list]));
  root.appendChild(addCard('نشان تازه', null, 'نشان تازه', [['شناسه (لاتین)', slug], ['عنوان', title], ['توضیح', desc], ['نوع', kind], ['امتیاز', perk], ['شرط خودکار', metric], ['حداقل', min]], function () {
    return api('/admin/badges', { method: 'POST', body: { slug: slug.value.trim(), titleFa: title.value.trim(), descriptionFa: desc.value.trim(), kind: kind.value, iconKey: kind.value === 'medal' ? 'medal' : 'star', perk: perk.value, ruleMetric: metric.value, ruleMin: +min.value, isActive: true } }).then(function (x) { if (x.status === 409) { toast('این شناسه از قبل هست', true); return false; } if (!x.ok) { fail(x); return false; } toast('نشان ساخته شد'); slug.value = ''; title.value = ''; desc.value = ''; draw(); return true; });
  }));
  draw();
};
VIEWS.taunts = function (root) {
  var list = h('div');
  var cities = [];
  function citySel(cur) {
    var sel = h('select', {}, [h('option', { value: '', text: 'همه‌ی شهرها' })].concat(cities.map(function (ct) { return h('option', { value: ct.id, text: 'فقط ' + ct.nameFa }); })));
    sel.value = cur || '';
    return sel;
  }
  function draw() {
    api('/admin/taunts').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('کل‌کل‌ها روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      r.body.categories.forEach(function (c) {
        var name = h('input', { type: 'text', value: c.nameFa, maxlength: 40 }), text = h('input', { type: 'text', placeholder: 'کل‌کل تازه…', maxlength: 120, style: 'flex:1' });
        var body = h('div', { style: 'display:flex;flex-direction:column;gap:6px;margin-top:8px' });
        c.taunts.forEach(function (t) {
          var tx = h('input', { type: 'text', value: t.text, maxlength: 120, style: 'flex:1' });
          body.appendChild(h('div', { style: 'display:flex;gap:6px;align-items:center' }, [tx, t.isActive ? null : badge('پنهان', 'b-warn'),
            h('button', { class: 'btn sm', text: 'ذخیره', onclick: function () { api('/admin/taunts/' + t.id, { method: 'PATCH', body: { text: tx.value.trim() } }).then(function (x) { if (!x.ok) return fail(x); toast('ذخیره شد'); draw(); }); } }),
            h('button', { class: 'btn sm', text: t.isActive ? 'پنهان' : 'نمایش', onclick: function () { api('/admin/taunts/' + t.id, { method: 'PATCH', body: { isActive: !t.isActive } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })]));
        });
        body.appendChild(h('div', { style: 'display:flex;gap:6px' }, [text, h('button', { class: 'btn primary sm', text: 'افزودن', onclick: function () { api('/admin/taunts', { method: 'POST', body: { categoryId: c.id, text: text.value.trim() } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })]));
        var where = citySel(c.cityId);
        where.onchange = function () { api('/admin/taunt-categories/' + c.id, { method: 'PATCH', body: { cityId: where.value || null } }).then(function (x) { if (!x.ok) return fail(x); toast('ذخیره شد'); }); };
        list.appendChild(h('div', { class: 'card', style: 'padding:12px' }, [
          h('div', { style: 'display:flex;gap:8px;align-items:center' }, [name, where, c.isActive ? null : badge('پنهان', 'b-warn'),
            h('button', { class: 'btn sm', text: 'تغییر نام', onclick: function () { api('/admin/taunt-categories/' + c.id, { method: 'PATCH', body: { nameFa: name.value.trim() } }).then(function (x) { if (!x.ok) return fail(x); toast('ذخیره شد'); draw(); }); } }),
            h('button', { class: 'btn sm', text: c.isActive ? 'پنهان‌کردن دسته' : 'نمایش دسته', onclick: function () { api('/admin/taunt-categories/' + c.id, { method: 'PATCH', body: { isActive: !c.isActive } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })]),
          body]));
      });
    });
  }
  var cat = h('input', { type: 'text', placeholder: 'نام دسته‌ی تازه', maxlength: 40 });
  var newWhere = citySel('');
  root.appendChild(card('کل‌کل‌های آماده', 'بازیکن‌ها در چت و در دوئل فقط از این فهرست کل‌کل می‌فرستند (بدون نیاز به کد معرف). لحن را شوخ نگه دار و توهین نکن. دسته‌ی مخصوص یک شهر (لهجه و اصطلاح محلی) فقط به بازیکن‌های همان شهر نشان داده می‌شود.', [list]));
  root.appendChild(card('دسته‌ی تازه', null, [h('div', { class: 'toolbar' }, [cat, newWhere, h('button', { class: 'btn primary', text: 'افزودن', onclick: function () { api('/admin/taunt-categories', { method: 'POST', body: { nameFa: cat.value.trim(), cityId: newWhere.value || null } }).then(function (x) { if (!x.ok) return fail(x); cat.value = ''; draw(); }); } })])]));
  api('/admin/cities').then(function (r) {
    if (r.ok) { cities = r.body.cities; var cur = newWhere.value; var fresh = citySel(cur); newWhere.innerHTML = fresh.innerHTML; newWhere.value = cur; }
    draw();
  });
};
VIEWS.chatreports = function (root) {
  var list = h('div');
  function draw() {
    api('/admin/chat/reports').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('چت روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      if (!r.body.reports.length) return list.appendChild(empty('گزارشی نیست'));
      r.body.reports.forEach(function (x) {
        list.appendChild(h('div', { class: 'kv' }, [
          h('span', { text: x.messageText }), h('span', { style: 'color:var(--muted);font-size:12px', text: (x.reason || 'بدون دلیل') + ' · ' + ago(x.createdAt) }),
          x.resolved ? badge('بررسی شد', 'b-ok') : h('button', { class: 'btn sm', text: 'بررسی شد', onclick: function () { api('/admin/chat/reports/' + x.id + '/resolve', { method: 'POST' }).then(function (y) { if (!y.ok) return fail(y); draw(); }); } }),
          h('button', { class: 'btn bad sm', text: 'حذف پیام', onclick: function () { api('/admin/chat/messages/' + x.messageId, { method: 'DELETE' }).then(function (y) { if (y.status === 404) toast('پیام قبلاً حذف شده', true); else if (!y.ok) return fail(y); draw(); }); } })]));
      });
    });
  }
  root.appendChild(card('گزارش‌های چت', 'پیام گزارش‌شده را ببین؛ حذف کن، یا از «کاربران» اخطار/سکوت بده.', [list]));
  draw();
};
VIEWS.tournaments = function (root) {
  var list = h('div');
  var STATUS = { draft: ['پیش‌نویس', 'b-mute'], open: ['ثبت‌نام باز', 'b-ok'], running: ['در حال برگزاری', 'b-warn'], finished: ['تمام‌شده', 'b-ok'], cancelled: ['لغوشده', 'b-bad'] };
  function when(ms) { return new Date(ms).toLocaleString('fa-IR'); }
  function draw() {
    api('/admin/tournaments').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('تورنومنت روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      if (!r.body.tournaments.length) return list.appendChild(empty('هنوز تورنومنتی نساخته‌ای'));
      r.body.tournaments.forEach(function (t) {
        var st = STATUS[t.status] || [t.status, 'b-mute'];
        var prizes = t.prizes.map(function (p) { return 'مقام ' + fa(p.place) + ': ' + faNum(p.coins) + (p.gems ? ' + ' + faNum(p.gems) + ' الماس' : '') + (p.spins ? ' + ' + faNum(p.spins) + ' چرخش' : ''); }).join(' · ');
        function act(path, ask) { return function () { if (ask && !confirm(ask)) return; api('/admin/tournaments/' + t.id + '/' + path, { method: 'POST' }).then(function (x) { if (!x.ok) return fail(x); toast('انجام شد'); draw(); }); }; }
        list.appendChild(h('div', { class: 'card', style: 'padding:12px' }, [
          h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [h('b', { text: t.titleFa }), badge(st[0], st[1]), h('span', { class: 'h', text: fa(t.joined) + ' از ' + fa(t.size) + ' نفر · ورودی ' + faNum(t.entryCoins) + ' سکه' + (t.entryGems ? ' + ' + faNum(t.entryGems) + ' الماس' : '') + ' · از لول ' + fa(t.minLevel) + ' · شروع ' + when(t.startsAt) })]),
          h('div', { class: 'h', style: 'margin-top:4px', text: prizes || 'بدون جایزه' }),
          h('div', { class: 'toolbar', style: 'margin-top:8px' }, [
            t.status === 'draft' ? h('button', { class: 'btn primary', text: 'منتشر کن (باز کردن ثبت‌نام)', onclick: act('publish') }) : null,
            t.status === 'open' ? h('button', { class: 'btn primary', text: 'همین حالا شروع کن', onclick: act('start', 'ثبت‌نام بسته و تورنومنت شروع شود؟ اگر به حد نصاب نرسیده باشد لغو و ورودی‌ها برگردانده می‌شود.') }) : null,
            t.status === 'draft' || t.status === 'open' || t.status === 'running' ? h('button', { class: 'btn bad', text: 'لغو و بازپرداخت', onclick: act('cancel', 'تورنومنت لغو شود و ورودی همه برگردانده شود؟') }) : null
          ])
        ]));
      });
    });
  }
  var title = h('input', { type: 'text', placeholder: 'نام تورنومنت', maxlength: 80 }), desc = h('textarea', { placeholder: 'توضیحات برای صفحه‌ی اختصاصی تورنومنت (قانون‌ها، جایزه‌ها، داستان)…', maxlength: 4000, style: 'min-height:90px' });
  var size = select([['4', '۴ نفر'], ['8', '۸ نفر'], ['16', '۱۶ نفر'], ['32', '۳۲ نفر']], '16');
  function num(v, min) { return h('input', { type: 'number', value: v, min: min === undefined ? 0 : min, style: 'width:100px' }); }
  var minPlayers = num(4, 2), fee = num(20), gemFee = num(0), level = num(1, 1), p1 = num(100), p2 = num(40), p3 = num(10), s1 = num(0), s2 = num(0), s3 = num(0), g1 = num(0), g2 = num(0), g3 = num(0);
  var startsAt = h('input', { type: 'datetime-local' });
  var publish = h('input', { type: 'checkbox' });
  var botFill = h('input', { type: 'checkbox' });
  var concurrent = h('input', { type: 'checkbox' });
  var note = h('div', { class: 'h' });
  function recalc() { var pool = +fee.value * +size.value, prizes = (+p1.value) + (+p2.value) + 2 * (+p3.value); note.textContent = 'جمع ورودی اگر پر شود: ' + faNum(pool) + ' سکه · جمع جایزه‌ها: ' + faNum(prizes) + ' سکه' + (prizes > pool ? ' ← جایزه از ورودی بیشتر است؛ این تفاوت سکه‌ی تازه به اقتصاد اضافه می‌کند.' : ''); }
  [fee, size, p1, p2, p3].forEach(function (el) { el.addEventListener('input', recalc); }); recalc();
  root.appendChild(card('تورنومنت‌ها', 'جدول حذفی تک‌حذفی؛ هر دور با یک دوئل. بازیکنی که نرسد یا ببازد حذف می‌شود، تساوی دوباره بازی می‌شود.', [list]));
  root.appendChild(addCard('تورنومنت تازه', 'مقام سوم به هر دو بازنده‌ی نیمه‌نهایی داده می‌شود. اگر تعداد ثبت‌نام‌ها کمتر از ظرفیت باشد، جدول با «بای» پر می‌شود (به شرط رسیدن به حداقل نفرات).', 'تورنومنت تازه', [
    ['نام', title], ['توضیحات', desc],
    h('div', { class: 'toolbar' }, [field('ظرفیت', size), field('حداقل نفرات برای برگزاری', minPlayers), field('ورودی (سکه، ۰ = رایگان)', fee), field('ورودی الماس (۰ = بدون الماس)', gemFee), field('کمترین لول (۱ = همه)', level), field('شروع و بسته‌شدن ثبت‌نام', startsAt)]),
    h('div', { class: 'toolbar' }, [field('جایزه‌ی مقام اول', p1), field('مقام دوم', p2), field('مقام سوم (به هر نفر)', p3)]),
    h('div', { class: 'toolbar' }, [field('الماس مقام اول', g1), field('مقام دوم', g2), field('مقام سوم (به هر نفر)', g3)]),
    h('div', { class: 'toolbar' }, [field('چرخش گردونه‌ی مقام اول', s1), field('مقام دوم', s2), field('مقام سوم (به هر نفر)', s3)]),
    note,
    h('div', { class: 'toolbar' }, [h('label', {}, [botFill, ' جای خالی با ربات پر شود']), h('label', {}, [concurrent, ' کسی که در تورنومنت دیگری هست هم بتواند وارد شود']), h('label', {}, [publish, ' همین حالا منتشر شود'])])
  ], function () {
    if (!startsAt.value) { toast('زمان شروع را بگذار', true); return false; }
    var prizes = [{ place: 1, coins: +p1.value, gems: +g1.value, spins: +s1.value }, { place: 2, coins: +p2.value, gems: +g2.value, spins: +s2.value }, { place: 3, coins: +p3.value, gems: +g3.value, spins: +s3.value }].filter(function (p) { return p.coins > 0 || p.gems > 0 || p.spins > 0; });
    return api('/admin/tournaments', { method: 'POST', body: { titleFa: title.value.trim(), descriptionFa: desc.value.trim(), iconKey: 'trophy', size: +size.value, minPlayers: +minPlayers.value, entryCoins: +fee.value, entryGems: +gemFee.value, minLevel: +level.value, startsAt: new Date(startsAt.value).getTime(), botFill: botFill.checked, allowConcurrent: concurrent.checked, prizes: prizes, publish: publish.checked } }).then(function (x) { if (!x.ok) { fail(x); return false; } toast('تورنومنت ساخته شد'); title.value = ''; desc.value = ''; draw(); return true; });
  }));
  draw();
};
VIEWS.bots = function (root) {
  var list = h('div');
  function num(v, min, max) { return h('input', { type: 'number', value: v, min: min, max: max, style: 'width:90px' }); }
  function draw() {
    api('/admin/bots').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('بازیکن‌های ربات روی این سرور فعال نیستند'));
      if (!r.ok) return fail(r);
      if (!r.body.bots.length) return list.appendChild(empty('هنوز رباتی نساخته‌ای'));
      r.body.bots.forEach(function (b) {
        var skill = num(b.skill, 0, 100), taunt = num(b.tauntPercent, 0, 100), tmin = num(Math.round(b.thinkMinMs / 1000), 1, 60), tmax = num(Math.round(b.thinkMaxMs / 1000), 1, 60);
        function save(patch) { api('/admin/bots/' + b.userId, { method: 'PATCH', body: patch }).then(function (x) { if (!x.ok) return fail(x); toast('ذخیره شد'); draw(); }); }
        list.appendChild(h('div', { class: 'kv', style: 'flex-wrap:wrap;gap:8px;padding:8px 0;border-bottom:1px solid var(--line,#ddd)' }, [
          h('b', { text: b.nickname }), h('span', { class: 'h', text: 'لول ' + fa(b.level) + ' · ' + fa(b.games) + ' بازی · ' + fa(b.wins) + ' برد · ' + faNum(b.coins) + ' سکه' }), b.isActive ? null : badge('متوقف', 'b-warn'),
          field('مهارت', skill), field('جواب به کل‌کل ٪', taunt), field('فکر کردن (ثانیه)', h('span', { style: 'display:flex;gap:4px' }, [tmin, tmax])),
          h('button', { class: 'btn sm primary', text: 'ذخیره', onclick: function () { save({ skill: +skill.value, tauntPercent: +taunt.value, thinkMinMs: +tmin.value * 1000, thinkMaxMs: Math.max(+tmin.value, +tmax.value) * 1000 }); } }),
          h('button', { class: 'btn sm', text: b.isActive ? 'متوقف کن' : 'فعال کن', onclick: function () { save({ isActive: !b.isActive }); } })
        ]));
      });
    });
  }
  var count = num(10, 1, 50), lmin = num(2, 1, 100), lmax = num(15, 1, 100), smin = num(35, 0, 100), smax = num(80, 0, 100), wmin = num(40, 20, 85), wmax = num(62, 20, 85), tmin = num(3, 1, 60), tmax = num(12, 1, 60), taunt = num(40, 0, 100);
  var cities = h('input', { type: 'checkbox' }); cities.checked = true;
  root.appendChild(card('بازیکن‌های ربات', 'حساب‌هایی که بازی خودش بازی می‌کند و از بازیکن واقعی قابل‌تشخیص نیست: اسم، آواتار، شهر، لول، آمار، سکه و مدال طبیعی دارند، با تأخیر انسانی بازی می‌کنند و کل‌کل جواب می‌دهند. بازیکنی که چند ثانیه در صف مانده با یکی‌شان جفت می‌شود (تنظیمات «ربات» در بخش تنظیمات).', [list]));
  root.appendChild(card('ساخت گروهی', 'هر بار حداکثر ۵۰ ربات؛ اسم‌ها تکراری نیستند و فهرست اسم‌ها محدود است. مهارت یعنی چند درصد وقت‌ها گروه درست را پیدا می‌کند (هیچ‌وقت بیش از ۹۰٪).', [
    h('div', { class: 'toolbar' }, [field('تعداد', count), field('لول از', lmin), field('تا', lmax), field('مهارت از', smin), field('تا', smax)]),
    h('div', { class: 'toolbar' }, [field('درصد برد از', wmin), field('تا', wmax), field('فکر کردن از (ثانیه)', tmin), field('تا', tmax), field('جواب به کل‌کل ٪', taunt)]),
    h('div', { class: 'toolbar' }, [h('label', {}, [cities, ' شهر تصادفی هم بدهم']), h('button', { class: 'btn primary', text: 'بساز', onclick: function () {
      api('/admin/bots/generate', { method: 'POST', body: { count: +count.value, levelMin: +lmin.value, levelMax: Math.max(+lmin.value, +lmax.value), skillMin: +smin.value, skillMax: Math.max(+smin.value, +smax.value), winPercentMin: +wmin.value, winPercentMax: Math.max(+wmin.value, +wmax.value), thinkMinMs: +tmin.value * 1000, thinkMaxMs: Math.max(+tmin.value, +tmax.value) * 1000, tauntPercent: +taunt.value, withCities: cities.checked } }).then(function (x) { if (!x.ok) return fail(x); toast(fa(x.body.created) + ' ربات ساخته شد'); draw(); });
    } })])
  ]));
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
  function showRecipients(m) {
    api('/admin/messages/' + m.id + '/recipients').then(function (r) {
      if (!r.ok) return fail(r);
      var list = r.body.recipients;
      if (!list.length) return alert('برای این پیام گیرنده‌ی صندوق ثبت نشده (کانال‌های دیگر فقط تعداد را نگه می‌دارند).');
      alert('«' + m.title + '» به ' + fa(list.length) + ' بازیکن رسید:\n' + list.map(function (x) { return (x.nickname || x.userId) + (x.read ? ' ✓' : ''); }).join('، ') + '\n(✓ = خوانده)');
    });
  }
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
            h('td', {}, [h('button', { class: 'btn sm', text: 'گیرنده‌ها', onclick: function () { showRecipients(m); } }), m.retracted ? badge('پس گرفته شد', 'b-mute') : h('button', { class: 'btn bad sm', text: 'پس گرفتن از صندوق', onclick: function () { if (confirm('این پیام از صندوق همه‌ی بازیکنان برداشته شود؟ (پیام‌های بله و ... که رفته‌اند برنمی‌گردند)')) api('/admin/messages/' + m.id, { method: 'DELETE' }).then(function (x) { if (!x.ok) return fail(x); drawHistory(); }); } })])]);
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
  root.appendChild(addCard('حساب تازه', 'هر مدیر حساب جدا دارد و کارهایش با اسمش در «گزارش تغییرها» ثبت می‌شود.', 'حساب تازه', [['نام کاربری', un], ['نام نمایشی', dn], ['رمز', pw], ['نقش', role]], function () {
    return api('/admin/admins', { method: 'POST', body: { username: un.value.trim(), displayName: dn.value.trim() || un.value.trim(), password: pw.value, role: role.value } }).then(function (x) { if (!x.ok) { fail(x); return false; } toast('حساب ساخته شد'); un.value = ''; dn.value = ''; pw.value = ''; draw(); return true; });
  }));
  draw();
};
VIEWS.audit = function (root) {
  api('/admin/audit').then(function (r) {
    if (r.status === 404) return root.appendChild(empty('گزارش تغییرها روی این سرور فعال نیست'));
    if (!r.ok) return fail(r);
    root.appendChild(card('گزارش تغییرها', 'صد تغییر آخر', r.body.entries.length ? [h('div', { class: 'tbl-wrap' }, [h('table', {}, [h('thead', {}, [h('tr', {}, ['زمان', 'چه کسی', 'کار', 'هدف', 'جزئیات'].map(function (x) { return h('th', { text: x }); }))]), h('tbody', {}, r.body.entries.map(function (e) { return h('tr', {}, [h('td', { text: ago(e.at) }), h('td', { text: e.actor || '—' }), h('td', {}, [badge(e.action, 'b-info')]), h('td', { class: 'ltr', text: e.target }), h('td', { class: 'ltr', text: e.detail || '' })]); }))])])] : [empty('هنوز چیزی ثبت نشده')]));
  });
};

VIEWS.puzzles = function (root) {
  var LEVELS = [['زرد (آسان)', '#f5c542'], ['سبز', '#6cc24a'], ['آبی', '#3fa5e0'], ['بنفش (سخت)', '#9b59d0']];
  var prods = [];
  var readyBox = h('div'), listBox = h('div'), formBox = h('div'), autoBox = h('div');
  function drawReady(r) {
    clear(readyBox);
    var ok = r.products >= r.productsPerPuzzle;
    readyBox.appendChild(card('آمادگی کاتالوگ', 'هر پازل ' + fa(r.productsPerPuzzle) + ' کالای متمایز می‌خواهد: ۴ دسته‌ی ۴تایی', [
      h('div', { class: 'kv' }, [h('span', { text: 'کالاهای کاتالوگ' }), h('b', { class: 'num', text: fa(r.products) })]),
      h('div', { class: 'kv' }, [h('span', { text: 'کالاهای دارای ' + fa(3) + ' قیمت تأییدشده یا بیشتر' }), h('b', { class: 'num', text: fa(r.withPrices) })]),
      h('div', { class: 'kv' }, [h('span', { text: 'پازل تأییدشده (قابل بازی)' }), h('b', { class: 'num', text: fa(r.approvedPuzzles) })]),
      ok ? badge('کالا برای ساخت پازل کافی است', 'b-ok') : badge('هنوز ' + fa(r.productsPerPuzzle - r.products) + ' کالای دیگر لازم است؛ از «کاتالوگ محصولات» اضافه کن', 'b-warn')
    ]));
  }
  function drawForm() {
    clear(formBox);
    var titles = [], expls = [], sels = [];
    var opts = [['', '— کالا را انتخاب کن —']].concat(prods.map(function (p) { return [p.id, p.nameFa]; }));
    var blocks = LEVELS.map(function (lv, i) {
      titles[i] = h('input', { placeholder: 'عنوان بامزه‌ی دسته' });
      expls[i] = h('input', { placeholder: 'توضیح ساده‌ی قانون (مثلاً: همه‌شان سال ۷۵ حدود ۱۰۰ تومان بودند)' });
      sels[i] = [0, 1, 2, 3].map(function () { return select(opts, ''); });
      return h('div', { style: 'border-inline-start:6px solid ' + lv[1] + ';padding:6px 10px;margin:8px 0' }, [
        h('b', { text: 'دسته‌ی ' + lv[0] }),
        field('عنوان', titles[i]), field('توضیح', expls[i]),
        h('div', { style: 'display:grid;grid-template-columns:repeat(2,1fr);gap:6px' }, sels[i])
      ]);
    });
    var btn = h('button', { class: 'btn', text: 'ساخت پازل', onclick: function () {
      var groups = LEVELS.map(function (lv, i) { return { level: i, titleFa: titles[i].value, explanationFa: expls[i].value, productIds: sels[i].map(function (s) { return s.value; }) }; });
      if (groups.some(function (g) { return g.productIds.some(function (id) { return !id; }); })) return toast('هر ۱۶ کالا را انتخاب کن', true);
      api('/admin/puzzles', { method: 'POST', body: { groups: groups } }).then(function (r) {
        if (!r.ok) return r.body && r.body.error === 'duplicate_product' ? toast('یک کالا نباید دو بار در پازل بیاید', true) : fail(r);
        toast('پازل ساخته شد و قابل بازی است'); load();
      });
    } });
    formBox.appendChild(card('ساخت پازل دستی', 'چهار دسته، هر دسته چهار کالا؛ بعد از ساخت همان لحظه در بازی تکی و دوئل پخش می‌شود', blocks.concat([btn])));
  }
  function drawList(rows) {
    clear(listBox);
    if (!rows.length) return listBox.appendChild(card('پازل‌ها', '', [empty('هنوز پازلی نیست')]));
    function act(p, status) { api('/admin/puzzles/' + p.id, { method: 'PATCH', body: { status: status } }).then(function (r) { r.ok ? load() : fail(r); }); }
    listBox.appendChild(card('پازل‌ها', 'پیش‌نویس‌های ساخته‌شده‌ی خودکار را عنوان بده و تأیید کن', rows.map(function (p) {
      var draft = p.status === 'draft';
      var inputs = p.groups.map(function (g) { return h('input', { value: g.titleFa || '', 'data-level': String(g.level), style: 'width:100%' }); });
      var head = h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
        badge(p.status === 'approved' ? 'تأییدشده' : p.status === 'retired' ? 'بازنشسته' : 'پیش‌نویس', p.status === 'approved' ? 'b-ok' : draft ? 'b-warn' : 'b-mute'),
        badge(p.source === 'generated' ? 'خودکار' : 'دستی', 'b-info')
      ]);
      var body = draft
        ? h('div', {}, p.groups.map(function (g, i) { return h('div', { style: 'margin:4px 0' }, [h('div', { style: 'font-size:12px;color:var(--muted)', text: g.items.join('، ') }), inputs[i]]); }))
        : h('div', { style: 'font-size:13px;color:var(--muted)', text: p.groups.map(function (g) { return g.titleFa || '—'; }).join(' · ') });
      var btns = h('div', { style: 'display:flex;gap:6px;margin-top:6px' }, draft ? [
        h('button', { class: 'btn ok sm', text: 'ذخیره‌ی عنوان‌ها و تأیید', onclick: function () {
          var titles = inputs.map(function (i) { return { level: Number(i.getAttribute('data-level')), titleFa: i.value }; });
          api('/admin/puzzles/' + p.id + '/titles', { method: 'PUT', body: { titles: titles } }).then(function (r) { if (!r.ok) return fail(r); act(p, 'approved'); });
        } }),
        h('button', { class: 'btn bad sm', text: 'دور بریز', onclick: function () { act(p, 'retired'); } })
      ] : [p.status === 'approved'
        ? h('button', { class: 'btn bad sm', text: 'بازنشسته کن', onclick: function () { act(p, 'retired'); } })
        : h('button', { class: 'btn ok sm', text: 'دوباره فعال کن', onclick: function () { act(p, 'approved'); } })]);
      return h('div', { style: 'padding:8px 0;border-bottom:1px solid var(--line)' }, [head, body, btns]);
    })));
  }
  function drawAuto() {
    clear(autoBox);
    var n = h('input', { type: 'number', min: '1', max: '20', value: '5', style: 'width:80px' });
    autoBox.appendChild(card('ساخت خودکار', 'از کالاهای دارای قیمت تأییدشده، پازل یکتا و معتبر می‌سازد؛ به‌صورت پیش‌نویس می‌ماند تا خودت عنوان بنویسی و تأیید کنی', [
      h('div', { style: 'display:flex;gap:8px;align-items:center' }, [n, h('button', { class: 'btn', text: 'بساز', onclick: function () {
        api('/admin/puzzles/generate', { method: 'POST', body: { count: Number(n.value) || 1 } }).then(function (r) {
          if (!r.ok) return fail(r);
          var b = r.body;
          toast(b.created ? fa(b.created) + ' پیش‌نویس ساخته شد' : 'پازلی ساخته نشد؛ کاتالوگ فعلی (' + fa(b.catalogSize) + ' کالا با قیمت کافی) کم است', !b.created);
          load();
        });
      } })])
    ]));
  }
  function load() {
    api('/admin/puzzles').then(function (r) {
      if (r.status === 404) { clear(root); return root.appendChild(empty('بخش پازل روی این سرور فعال نیست')); }
      if (!r.ok) return fail(r);
      drawReady(r.body.readiness); drawList(r.body.puzzles);
    });
  }
  root.appendChild(readyBox); root.appendChild(autoBox); root.appendChild(listBox); root.appendChild(formBox); drawAuto();
  api('/admin/catalog').then(function (r) { if (!r.ok) return fail(r); prods = r.body.products; drawForm(); load(); });
};
`;
