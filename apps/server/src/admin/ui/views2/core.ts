/** Admin panel views: Bot inbox, sources, level road, daily reward, settings (browser JS, concatenated into one script by ../views2.ts). */
export const ADMIN_VIEWS2_CORE_JS = String.raw`
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
var GROUP_FA = { app: 'مدیریت اپ', gameplay: 'بازی', scoring: 'امتیاز', profile: 'پروفایل', economy: 'اقتصاد', chart: 'نمودار', bot: 'ربات محتوا', notify: 'اعلان‌های بله', review: 'نظر در فروشگاه‌ها', seo: 'سئو و سایت معرفی' };
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

`;
