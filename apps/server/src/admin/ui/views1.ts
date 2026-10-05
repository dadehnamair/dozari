export const ADMIN_VIEWS1_JS = String.raw`
/* ---------------- dashboard ---------------- */
function statCard(label, value, detail, tint, link, pct) {
  var kids = [h('div', { class: 'l' }, [h('i'), label]), h('div', { class: 'n num', text: value }), detail ? h('div', { class: 'd', text: detail }) : null,
    pct !== undefined && pct !== null ? h('div', { class: 'bar' }, [h('i', { style: 'width:' + Math.max(2, Math.min(100, pct)) + '%' })]) : null];
  return link ? h('a', { class: 'stat-card', style: '--tint:' + (tint || 'var(--brand)'), href: '#/' + link }, kids) : h('div', { class: 'stat-card', style: '--tint:' + (tint || 'var(--brand)') }, kids);
}
function greeting() { var hr = new Date().getHours(); return hr < 5 ? 'شب بخیر' : hr < 12 ? 'صبح بخیر' : hr < 17 ? 'ظهر بخیر' : hr < 20 ? 'عصر بخیر' : 'شب بخیر'; }
VIEWS.dashboard = function (root) {
  var date = new Date().toLocaleDateString('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  root.appendChild(pageHead(greeting() + '، ' + (S.me ? S.me.name : ''), date));
  var wrap = h('div'); root.appendChild(wrap);
  Promise.all([api('/admin/dashboard'), api('/admin/socket'), api('/admin/audit'), api('/admin/chat/reports'), api('/admin/settings'), api('/admin/age-tracks')]).then(function (rs) {
    var d = rs[0], sock = rs[1], aud = rs[2], rep = rs[3], set = rs[4], ages = rs[5];
    if (d.status === 404) wrap.appendChild(banner('info', 'آمار فقط وقتی دیتابیس وصل باشد نمایش داده می‌شود.'));
    var maint = set.ok && set.body.settings.filter(function (x) { return x.key === 'app.maintenance_on'; })[0];
    if (maint && maint.value === 1) wrap.appendChild(banner('bad', 'حالت تعمیر روشن است؛ بازیکن‌ها فقط پیام تعمیر را می‌بینند.', ['#/system/settings', 'خاموش کردن']));
    if (d.ok) {
      var b = d.body, todos = [];
      var openReports = rep.ok ? rep.body.reports.filter(function (x) { return !x.resolved; }).length : 0;
      if (b.catalog.pricesPending) todos.push(todoRow(b.catalog.pricesPending, 'قیمت منتظر تأیید', 'قیمت‌هایی که دستی ثبت شده‌اند', 'warn', '#/catalog/prices'));
      if (b.bot.candidatesPending) todos.push(todoRow(b.bot.candidatesPending, 'پیشنهاد ربات منتظر بررسی', b.bot.lastRunAt ? 'آخرین اجرا ' + ago(b.bot.lastRunAt) : 'ربات هنوز اجرا نشده', 'warn', '#/catalog/inbox'));
      if (openReports) todos.push(todoRow(openReports, 'گزارش چت باز', 'پیام‌هایی که بازیکن‌ها گزارش کرده‌اند', 'bad', '#/players/chatreports'));
      // Kid and teen content waits for a human: drafts nobody approved and lessons still unwritten or in draft (only shown once the age tracks exist).
      if (ages.ok) {
        var draftPuzzles = ages.body.puzzles.kid.draft + ages.body.puzzles.teen.draft;
        var lessonsLeft = ages.body.kidItems.missing + ages.body.kidItems.draft;
        if (draftPuzzles) todos.push(todoRow(draftPuzzles, 'پازل کودک و نوجوان منتظر تأیید', 'تا تأیید نشوند، رده‌ی سنی بازی‌کننده پازلی ندارد', 'warn', '#/game/puzzles'));
        if (lessonsLeft) todos.push(todoRow(lessonsLeft, 'درس کودک ننوشته یا تأییدنشده', 'درس تأییدنشده به بچه‌ها نمایش داده نمی‌شود', 'info', '#/game/lessons'));
      }
      if (rep.ok && rep.body.minorsQueue) {
        var openMinors = rep.body.reports.filter(function (x) { return !x.resolved && x.track && x.track !== 'adult'; }).length;
        if (openMinors) todos.push(todoRow(openMinors, 'گزارش چت کودک و نوجوان باز', 'اولویت بالا: بررسی کن و در صورت نیاز پیام را حذف کن', 'bad', '#/players/chatreports'));
      }
      if (b.bot.lastRunStatus === 'failed') todos.push(todoRow('!', 'آخرین اجرای ربات ناموفق بود', ago(b.bot.lastRunAt), 'bad', '#/catalog/sources'));
      if (b.catalog.withoutApprovedPrice) todos.push(todoRow(b.catalog.withoutApprovedPrice, 'محصول بدون قیمت تأییدشده', 'در پازل‌ها استفاده نمی‌شود', 'info', '#/catalog/catalog'));
      if (b.catalog.withoutIcon) todos.push(todoRow(b.catalog.withoutIcon, 'محصول بدون آیکن', 'آیکن را در کاتالوگ انتخاب کن', 'info', '#/catalog/catalog'));
      var kpis = h('div', { class: 'grid kpis' }, [
        statCard('کل بازیکنان', faNum(b.users.total), fa(b.users.newToday) + ' جدید · ' + fa(b.users.banned) + ' مسدود', '#4f46e5', 'players/users', b.users.total ? (b.users.activeToday / b.users.total) * 100 : 0),
        statCard('فعال در ۲۴ ساعت', faNum(b.users.activeToday), b.users.total ? fa(Math.round((b.users.activeToday / b.users.total) * 100)) + '٪ از بازیکن‌ها' : '', '#14b8a6', 'players/users'),
        statCard('محصولات', faNum(b.catalog.products), fa(b.catalog.activeProducts) + ' فعال · ' + faNum(b.catalog.pricesApproved) + ' قیمت تأییدشده', '#f5b73b', 'catalog/catalog'),
        statCard('پازل‌ها', faNum(b.puzzles), 'ثبت‌شده', '#ef6c3d', 'game/puzzles'),
        statCard('سکه در گردش', faNum(b.economy.coinsInCirculation), fa(b.economy.dailyClaimsToday) + ' جایزه‌ی روزانه در ۲۴ ساعت', '#22a45d', 'economy/daily')
      ]);
      wrap.appendChild(kpis);
      var left = h('section', { class: 'card flush' }, [h('div', { class: 'card-h' }, [h('h2', { text: 'کارهای منتظر تو' }), todos.length ? badge(fa(todos.length), 'b-warn') : null]),
        todos.length ? h('div', {}, todos) : h('div', { class: 'empty-state' }, [h('b', { text: 'همه‌چیز مرتب است 🎉' }), 'کار معوقی نیست.'])]);
      var live = h('section', { class: 'card flush' }, [h('div', { class: 'card-h' }, [h('h2', { text: 'سرور زنده' }), h('a', { href: '#/system/socket', class: 'btn sm', text: 'جزئیات' })]),
        sock.ok ? h('div', { style: 'padding:6px 20px 12px' }, [
          h('div', { class: 'kv' }, [h('span', { text: 'اتصال فعال' }), h('b', { class: 'num', text: fa(sock.body.connections) })]),
          h('div', { class: 'kv' }, [h('span', { text: 'در صف مسابقه' }), h('b', { class: 'num', text: fa(sock.body.queueLength) + ' نفر' })]),
          h('div', { class: 'kv' }, [h('span', { text: 'طولانی‌ترین انتظار در صف' }), h('b', { class: 'num', text: fa(sock.body.longestWaitSec) + ' ثانیه' })]),
          h('div', { class: 'kv' }, [h('span', { text: 'مسابقه‌ی جاری' }), h('b', { class: 'num', text: fa(sock.body.activeMatches) })]),
          h('div', { class: 'kv' }, [h('span', { text: 'بیشترین اتصال همزمان' }), h('b', { class: 'num', text: fa(sock.body.peakConnections) })])
        ]) : h('div', { class: 'empty-state', text: 'سرویس سوکت فعال نیست' })]);
      wrap.appendChild(h('div', { class: 'cols' }, [left, live]));
      wrap.appendChild(h('div', { style: 'height:16px' }));
      if (b.ageBands) {
        var abTotal = b.ageBands.reduce(function (t, x) { return t + x.count; }, 0);
        wrap.appendChild(h('section', { class: 'card' }, [h('h2', { text: 'سن بازیکن‌ها' }), h('div', { class: 'sub', text: 'فقط آمار کلی؛ ' + fa(b.ageUnknown) + ' نفر تاریخ تولد نداده‌اند' })].concat(abTotal === 0 ? [empty('هنوز کسی تاریخ تولدش را نگفته')] : b.ageBands.map(function (x) {
          var pct = Math.round((x.count / abTotal) * 100);
          return h('div', { class: 'kv' }, [h('span', { text: fa(x.key.replace('+', '')) + (x.key.indexOf('+') > -1 ? '+' : '') + ' سال' }), h('span', { style: 'flex:1;margin:0 14px' }, [h('div', { class: 'bar', style: 'margin:0' }, [h('i', { style: 'width:' + Math.max(2, pct) + '%' })])]), h('span', {}, [h('b', { class: 'num', text: faNum(x.count) }), ' ', h('span', { class: 'muted', text: fa(pct) + '٪' })])]);
        }))));
      }
    }
    var entries = aud.ok ? aud.body.entries.slice(0, 8) : [];
    wrap.appendChild(h('div', { style: 'height:16px' }));
    wrap.appendChild(h('section', { class: 'card flush' }, [h('div', { class: 'card-h' }, [h('h2', { text: 'آخرین تغییرها' }), h('a', { href: '#/system/audit', class: 'btn sm', text: 'همه' })]),
      entries.length ? h('div', { style: 'padding:4px 20px 10px' }, entries.map(function (e) {
        return h('div', { class: 'kv' }, [h('span', {}, [badge(e.action, 'b-info'), ' ', h('span', { text: String(e.target).slice(0, 60) })]), h('span', { class: 'muted', style: 'font-size:12.5px', text: (e.actor ? e.actor + ' · ' : '') + ago(e.at) })]);
      })) : h('div', { class: 'empty-state', text: 'هنوز تغییری ثبت نشده' })]));
    var links = [['players/users', 'users', 'کاربران'], ['catalog/prices', 'prices', 'بازبینی قیمت'], ['game/puzzles', 'puzzles', 'ساخت پازل'], ['comms/messages', 'messages', 'پیام همگانی'], ['system/settings', 'settings', 'تنظیمات']];
    wrap.appendChild(h('section', { class: 'card flush' }, [h('div', { class: 'card-h' }, [h('h2', { text: 'میان‌برها' })]), h('div', { class: 'quick-links' }, links.map(function (l) { return h('a', { href: '#/' + l[0] }, [ic(l[1]), l[2]]); }))]));
  });
};

/* ---------------- catalog ---------------- */
var CAT = { products: [], filter: 'all', q: '' };
function productHasApproved(p) { return p.prices.some(function (x) { return x.status === 'approved'; }); }
function dateFa(m) { return fa(m.year) + (m.month ? '/' + fa(m.month) : ''); }
function rangeText(p) {
  var r = p.range;
  if (!r) return 'بازه‌ی قیمت: بدون قیمت تأییدشده';
  return 'از ' + dateFa(r.first) + ' تا ' + dateFa(r.last) + ' · ' + toman(r.min.priceRials) + ' تا ' + toman(r.max.priceRials);
}
VIEWS.catalog = function (root) {
  var list = h('div', { class: 'pgrid' });
  var search = h('input', { type: 'search', placeholder: 'جستجوی محصول…', value: CAT.q });
  var chips = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' });
  var FILTERS = [['all', 'همه'], ['noicon', 'بدون آیکن'], ['noprice', 'بدون قیمت تأییدشده'], ['few', 'قیمت کم (زیر حداقل)'], ['inactive', 'غیرفعال'], ['kid', 'کالای کودک'], ['teen', 'کالای نوجوان']];
  function draw() {
    clear(chips);
    FILTERS.forEach(function (f) { chips.appendChild(h('button', { class: 'chip', 'aria-pressed': String(CAT.filter === f[0]), text: f[1], onclick: function () { CAT.filter = f[0]; draw(); } })); });
    clear(list);
    var q = CAT.q.trim();
    var rows = CAT.products.filter(function (p) {
      if (q && (p.nameFa + ' ' + p.slug).indexOf(q) < 0) return false;
      if (CAT.filter === 'noicon') return !p.iconKey;
      if (CAT.filter === 'noprice') return !productHasApproved(p);
      if (CAT.filter === 'few') return p.needsMorePrices === true;
      if (CAT.filter === 'inactive') return p.isActive === false;
      if (CAT.filter === 'kid' || CAT.filter === 'teen') return (p.ageTrack || 'adult') === CAT.filter;
      return true;
    });
    if (!rows.length) list.appendChild(empty('محصولی پیدا نشد'));
    rows.forEach(function (p) {
      var approved = p.prices.filter(function (x) { return x.status === 'approved'; }).length;
      var pending = p.prices.filter(function (x) { return x.status === 'pending'; }).length;
      list.appendChild(h('div', { class: 'pcard', onclick: function () { editProduct(p); } }, [
        iconTile(p.iconKey),
        h('div', { style: 'min-width:0;flex:1' }, [
          h('div', { class: 't', text: p.nameFa }),
          h('div', { class: 'm', text: (CAT_FA[p.category] || p.category || '') + (p.unitFa ? ' · ' + p.unitFa : '') }),
          h('div', { class: 'm', text: rangeText(p) }),
          h('div', { style: 'margin-top:4px;display:flex;gap:4px;flex-wrap:wrap' }, [
            badge(fa(approved) + ' تأییدشده', approved ? 'b-ok' : 'b-warn'), p.needsMorePrices ? badge('قیمت بیشتر لازم است', 'b-warn') : null, pending ? badge(fa(pending) + ' در انتظار', 'b-info') : null, p.isActive === false ? badge('غیرفعال', 'b-bad') : null
          ])
        ])
      ]));
    });
  }
  search.addEventListener('input', function () { CAT.q = search.value; draw(); });
  root.appendChild(h('div', { class: 'toolbar' }, [search, chips, h('span', { style: 'flex:1' }), h('button', { class: 'btn primary', text: '＋ محصول جدید', onclick: newProduct })]));
  root.appendChild(list);
  api('/admin/catalog').then(function (r) { if (!r.ok) return fail(r); CAT.products = r.body.products; draw(); });
};
function productForm(p) {
  var f = {
    nameFa: h('input', { type: 'text', value: p.nameFa || '' }), unitFa: h('input', { type: 'text', value: p.unitFa || '', placeholder: 'مثلاً: یک عدد، هر لیتر' }),
    brand: h('input', { type: 'text', value: p.brand || '' }), category: select(catOptions(), p.category || 'food'),
    status: select([['in_production', 'در حال تولید'], ['discontinued', 'متوقف‌شده'], ['changed', 'تغییرکرده']], p.status || 'in_production'),
    ageTrack: select([['adult', 'بزرگسال'], ['teen', 'نوجوان'], ['kid', 'کودک']], p.ageTrack || 'adult'),
    isActive: h('input', { type: 'checkbox', checked: p.isActive !== false }), storyFa: h('textarea', { text: p.storyFa || '' })
  };
  f.storyFa.value = p.storyFa || '';
  return f;
}
function newProduct() {
  var slug = h('input', { type: 'text', class: 'ltr', placeholder: 'sangak-bread', dir: 'ltr' });
  var f = productForm({}), icon = null;
  var tile = h('div'); tile.appendChild(iconTile(null));
  var body = h('div', { style: 'display:flex;flex-direction:column;gap:12px' }, [
    h('div', { class: 'form-grid' }, [field('نام فارسی', f.nameFa), field('شناسه انگلیسی (slug)', slug, 'حروف کوچک، عدد و خط تیره'), field('دسته', f.category), field('واحد', f.unitFa)]),
    h('div', {}, [h('div', { class: 'sub', text: 'آیکن', style: 'color:var(--muted);font-size:13px;margin-bottom:6px' }), iconPicker(null, function (k) { icon = k; })])
  ]);
  modal('محصول جدید', body, [{ label: 'انصراف' }, { label: 'ساخت', cls: 'primary', keepOpen: true, run: function (close) {
    api('/admin/products', { method: 'POST', body: { slug: slug.value.trim(), nameFa: f.nameFa.value.trim(), category: f.category.value, unitFa: f.unitFa.value.trim() || null, iconKey: icon } }).then(function (r) {
      if (!r.ok) return fail(r); toast('محصول ساخته شد'); close(); route();
    }); return false; } }]);
}
function editProduct(p) {
  var f = productForm(p), icon = p.iconKey || null;
  var tile = h('div', { style: 'display:flex;gap:12px;align-items:center' }, [iconTile(icon), h('div', { text: icon ? icon : 'آیکنی انتخاب نشده', class: 'ltr', style: 'color:var(--muted)' })]);
  var picker = iconPicker(icon, function (k) { icon = k; clear(tile); tile.appendChild(iconTile(k)); tile.appendChild(h('div', { text: k, class: 'ltr', style: 'color:var(--muted)' })); });
  var prices = h('div');
  function drawPrices() {
    clear(prices);
    if (!p.prices.length) prices.appendChild(empty('قیمتی ثبت نشده'));
    else prices.appendChild(h('div', { class: 'tbl-wrap' }, [h('table', {}, [
      h('thead', {}, [h('tr', {}, ['سال', 'قیمت', 'منبع', 'وضعیت', ''].map(function (t) { return h('th', { text: t }); }))]),
      h('tbody', {}, p.prices.map(function (x) {
        return h('tr', {}, [h('td', { class: 'num', text: fa(x.year) + (x.month ? '/' + fa(x.month) : '') }), h('td', { class: 'num', text: toman(x.priceRials) }),
          h('td', {}, [x.sourceUrl ? h('a', { href: safeHref(x.sourceUrl), target: '_blank', rel: 'noopener noreferrer', text: SRC_FA[x.sourceType] || x.sourceType }) : (SRC_FA[x.sourceType] || x.sourceType)]),
          h('td', {}, [badge(x.status === 'approved' ? 'تأییدشده' : x.status === 'pending' ? 'در انتظار' : 'ردشده', x.status === 'approved' ? 'b-ok' : x.status === 'pending' ? 'b-info' : 'b-bad')]),
          h('td', {}, [x.status !== 'approved' ? h('button', { class: 'btn ok sm', text: 'تأیید', onclick: function () { setPrice(x, 'approved', drawPrices); } }) : null, ' ', x.status !== 'rejected' ? h('button', { class: 'btn bad sm', text: 'رد', onclick: function () { setPrice(x, 'rejected', drawPrices); } }) : null])]);
      }))
    ])]));
  }
  drawPrices();
  var yr = h('input', { type: 'number', placeholder: '۱۳۷۵', min: 1300, max: 1450 }), price = h('input', { type: 'number', placeholder: 'قیمت به تومان', min: 1 }), srcT = select(Object.keys(SRC_FA).map(function (k) { return [k, SRC_FA[k]]; }), 'archive_newspaper'), srcU = h('input', { type: 'url', dir: 'ltr', placeholder: 'https://… (اختیاری)' }), note = h('input', { type: 'text', placeholder: 'توضیح منبع (اختیاری)' });
  var addBtn = h('button', { class: 'btn', text: 'ثبت قیمت (در انتظار تأیید)', onclick: function () {
    var t = Number(price.value);
    if (!yr.value || !t) return toast('سال و قیمت را وارد کن', true);
    api('/admin/prices', { method: 'POST', body: { productId: p.id, year: Number(yr.value), priceRials: String(Math.round(t * 10)), sourceType: srcT.value, sourceUrl: srcU.value.trim() || null, sourceNote: note.value.trim() || null } }).then(function (r) {
      if (!r.ok) return fail(r); toast('قیمت ثبت شد؛ برای نمایش در بازی باید تأیید شود'); route();
    });
  } });
  var body = h('div', { style: 'display:flex;flex-direction:column;gap:16px' }, [
    h('div', { class: 'form-grid' }, [field('نام فارسی', f.nameFa), field('واحد', f.unitFa), field('برند', f.brand), field('دسته', f.category), field('وضعیت تولید', f.status), field('رده‌ی سنی', f.ageTrack), h('label', { class: 'f' }, ['فعال', f.isActive])]),
    field('داستان کوتاه محصول', f.storyFa),
    h('div', {}, [h('div', { text: 'آیکن', style: 'font-weight:700;margin-bottom:6px' }), tile, picker]),
    h('div', {}, [h('div', { text: 'قیمت‌ها', style: 'font-weight:700;margin-bottom:6px' }), h('div', { class: 'm', style: 'color:var(--muted);font-size:13px;margin-bottom:8px', text: rangeText(p) + (p.needsMorePrices ? ' — برای نمایش بازه حداقل چند قیمت در تاریخ‌های مختلف لازم است' : '') }), prices]),
    h('div', {}, [h('div', { text: 'افزودن قیمت دستی', style: 'font-weight:700;margin-bottom:6px' }), h('div', { class: 'form-grid' }, [field('سال شمسی', yr), field('قیمت (تومان)', price), field('نوع منبع', srcT), field('لینک منبع', srcU), field('توضیح منبع', note)]), h('div', { style: 'margin-top:8px' }, [addBtn])])
  ]);
  modal(p.nameFa, body, [{ label: 'بستن' }, { label: 'ذخیره', cls: 'primary', keepOpen: true, run: function (close) {
    api('/admin/products/' + p.id, { method: 'PATCH', body: { nameFa: f.nameFa.value.trim(), unitFa: f.unitFa.value.trim() || null, brand: f.brand.value.trim() || null, category: f.category.value, status: f.status.value, ageTrack: f.ageTrack.value, isActive: f.isActive.checked, storyFa: f.storyFa.value.trim() || null, iconKey: icon } }).then(function (r) {
      if (!r.ok) return fail(r); toast('ذخیره شد'); close(); route();
    }); return false; } }]);
}
function setPrice(x, status, redraw) {
  api('/admin/prices/' + x.id, { method: 'PATCH', body: { status: status } }).then(function (r) {
    if (!r.ok) return fail(r); x.status = status; toast(status === 'approved' ? 'قیمت تأیید شد' : 'قیمت رد شد'); redraw(); refreshCounts();
  });
}

/* ---------------- price review queue ---------------- */
function flagsFor(p, x) {
  var prev = null, out = [];
  p.prices.forEach(function (o) { if (o.status !== 'rejected' && (o.year < x.year || (o.year === x.year && (o.month || 0) < (x.month || 0)))) prev = o; });
  if (!prev) return out;
  var a = Number(prev.priceRials), b = Number(x.priceRials);
  if (a > 0 && b < a * 0.7) out.push('افت بیش از ۳۰٪ نسبت به ' + fa(prev.year));
  if (a > 0 && b > a * 5) out.push('جهش بیش از ۵ برابر نسبت به ' + fa(prev.year));
  return out;
}
VIEWS.prices = function (root) {
  var status = 'pending';
  var tabs = h('div', { style: 'display:flex;gap:6px' }), list = h('div');
  root.appendChild(h('div', { class: 'toolbar' }, [tabs])); root.appendChild(list);
  var products = [];
  function draw() {
    clear(tabs);
    [['pending', 'در انتظار'], ['approved', 'تأییدشده'], ['rejected', 'ردشده']].forEach(function (t) { tabs.appendChild(h('button', { class: 'chip', 'aria-pressed': String(status === t[0]), text: t[1], onclick: function () { status = t[0]; draw(); } })); });
    clear(list);
    var n = 0;
    products.forEach(function (p) {
      var rows = p.prices.filter(function (x) { return x.status === status; });
      if (!rows.length) return; n++;
      list.appendChild(h('section', { class: 'card' }, [h('div', { style: 'display:flex;gap:10px;align-items:center;margin-bottom:8px' }, [iconTile(p.iconKey), h('h2', { text: p.nameFa, style: 'margin:0' }), p.unitFa ? badge(p.unitFa) : null])].concat(rows.map(function (x) {
        var fl = flagsFor(p, x);
        return h('div', { class: 'kv', style: 'align-items:center;flex-wrap:wrap' }, [
          h('div', {}, [h('b', { class: 'num', text: fa(x.year) + (x.month ? '/' + fa(x.month) : '') + ' — ' + toman(x.priceRials) }),
            h('div', { class: 'sub', style: 'color:var(--muted);font-size:13px' }, [(SRC_FA[x.sourceType] || x.sourceType) + ' · اطمینان ' + fa(x.confidence) + ' ', x.sourceUrl ? h('a', { href: safeHref(x.sourceUrl), target: '_blank', rel: 'noopener noreferrer', text: 'منبع' }) : null, x.sourceNote ? ' · ' + x.sourceNote : '']),
            fl.map(function (t) { return h('span', { class: 'flag', text: '⚠ ' + t }); })]),
          h('div', { style: 'display:flex;gap:6px' }, [x.status !== 'approved' ? h('button', { class: 'btn ok sm', text: 'تأیید', onclick: function () { setPrice(x, 'approved', draw); } }) : null, x.status !== 'rejected' ? h('button', { class: 'btn bad sm', text: 'رد', onclick: function () { setPrice(x, 'rejected', draw); } }) : null, x.status !== 'pending' ? h('button', { class: 'btn sm', text: 'برگرداندن به انتظار', onclick: function () { setPrice(x, 'pending', draw); } }) : null])
        ]);
      }))));
    });
    if (!n) list.appendChild(empty(status === 'pending' ? 'همه‌ی قیمت‌ها بازبینی شده‌اند 🎉' : 'موردی نیست'));
    // Prices the bot finds wait in its own inbox, not here: point there when something is waiting.
    if (!n && status === 'pending' && S.counts && S.counts.inbox) list.appendChild(h('div', { class: 'card' }, [h('p', { text: 'این‌جا فقط قیمت‌هایی که خودت دستی ثبت کرده‌ای می‌آید. ' + fa(S.counts.inbox) + ' پیشنهاد قیمت از ربات در «صندوق ربات» منتظر بررسی است.' }), h('a', { class: 'btn sm', href: '#/inbox', text: 'رفتن به صندوق ربات' })]));
  }
  api('/admin/catalog').then(function (r) { if (!r.ok) return fail(r); products = r.body.products; draw(); refreshCounts(); });
};
`;
