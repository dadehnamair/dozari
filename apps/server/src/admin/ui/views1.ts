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
var CAT = { products: [], sim: {}, filter: 'all', q: '' };
function productHasApproved(p) { return p.prices.some(function (x) { return x.status === 'approved'; }); }
function dateFa(m) { return fa(m.year) + (m.month ? '/' + fa(m.month) : ''); }
function rangeText(p) {
  var r = p.range;
  if (!r) return 'بازه‌ی قیمت: بدون قیمت تأییدشده';
  return 'از ' + dateFa(r.first) + ' تا ' + dateFa(r.last) + ' · ' + toman(r.min.priceRials) + ' تا ' + toman(r.max.priceRials);
}
/* Similar products (D251): same normalized name, or a name (4+ chars) contained in another. Returns id -> { n: group size, gid: group key }. */
function nameKeyFa(s) { return String(s || '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[‌‏\s\-_.،,()«»]/g, '').toLowerCase(); }
function similarGroups(products) {
  var keys = products.map(function (p) { return nameKeyFa(p.nameFa); });
  var parent = products.map(function (_, i) { return i; });
  function root(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
  for (var i = 0; i < keys.length; i++) for (var j = i + 1; j < keys.length; j++) {
    var a = keys[i], b = keys[j];
    if (!a || !b) continue;
    var lo = a.length <= b.length ? a : b, hi = a.length <= b.length ? b : a;
    if (lo === hi || (lo.length >= 4 && hi.indexOf(lo) >= 0)) parent[root(i)] = root(j);
  }
  var size = {}, out = {};
  products.forEach(function (p, i) { var r = root(i); size[r] = (size[r] || 0) + 1; });
  products.forEach(function (p, i) { var r = root(i); out[p.id] = { n: size[r], gid: keys[r] }; });
  return out;
}
VIEWS.catalog = function (root) {
  var list = h('div', { class: 'pgrid' });
  var search = h('input', { type: 'search', placeholder: 'جستجوی محصول…', value: CAT.q });
  var chips = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' });
  var FILTERS = [['all', 'همه'], ['noicon', 'بدون آیکن'], ['noprice', 'بدون قیمت تأییدشده'], ['few', 'قیمت کم (زیر حداقل)'], ['inactive', 'غیرفعال'], ['similar', 'دارای محصول مشابه'], ['kid', 'کالای کودک'], ['teen', 'کالای نوجوان']];
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
      if (CAT.filter === 'similar') return CAT.sim[p.id] && CAT.sim[p.id].n > 1;
      if (CAT.filter === 'kid' || CAT.filter === 'teen') return (p.ageTrack || 'adult') === CAT.filter;
      return true;
    });
    if (CAT.filter === 'similar') rows.sort(function (a, b) { var x = CAT.sim[a.id].gid, y = CAT.sim[b.id].gid; return x < y ? -1 : x > y ? 1 : 0; });
    if (!rows.length) list.appendChild(empty('محصولی پیدا نشد'));
    rows.forEach(function (p) {
      var sim = CAT.sim[p.id];
      var approved = p.prices.filter(function (x) { return x.status === 'approved'; }).length;
      var pending = p.prices.filter(function (x) { return x.status === 'pending'; }).length;
      list.appendChild(h('div', { class: 'pcard', onclick: function () { editProduct(p); } }, [
        iconTile(p.iconKey),
        h('div', { style: 'min-width:0;flex:1' }, [
          h('div', { class: 't', text: p.nameFa }),
          h('div', { class: 'm', text: (CAT_FA[p.category] || p.category || '') + (p.unitFa ? ' · ' + p.unitFa : '') }),
          h('div', { class: 'm', text: rangeText(p) }),
          h('div', { style: 'margin-top:4px;display:flex;gap:4px;flex-wrap:wrap' }, [
            badge(fa(approved) + ' تأییدشده', approved ? 'b-ok' : 'b-warn'), p.needsMorePrices ? badge('قیمت بیشتر لازم است', 'b-warn') : null, pending ? badge(fa(pending) + ' در انتظار', 'b-info') : null, p.isActive === false ? badge('غیرفعال', 'b-bad') : null,
            sim && sim.n > 1 ? badge('⧉ ' + fa(sim.n) + ' محصول مشابه', 'b-info') : null
          ])
        ])
      ]));
    });
  }
  search.addEventListener('input', function () { CAT.q = search.value; draw(); });
  root.appendChild(h('div', { class: 'toolbar' }, [search, chips, h('span', { style: 'flex:1' }), h('button', { class: 'btn primary', text: '＋ محصول جدید', onclick: newProduct })]));
  root.appendChild(list);
  api('/admin/catalog').then(function (r) { if (!r.ok) return fail(r); CAT.products = r.body.products; CAT.sim = similarGroups(CAT.products); draw(); });
};

/* ---------- product categories (دسته‌بندی محصولات) ---------- */
VIEWS.categories = function (root) {
  var box = h('div');
  root.appendChild(card('دسته‌بندی محصولات', 'هر محصول زیر یک دسته می‌رود. اسم فارسی، ترتیب و روشن/خاموش بودن را می‌شود عوض کرد؛ شناسه‌ی لاتین بعد از ساخت ثابت می‌ماند. دسته‌ی خاموش دیگر برای محصول تازه انتخاب نمی‌شود و ربات هوش مصنوعی هم از آن استفاده نمی‌کند. «متفرقه» همیشه می‌ماند.', [box]));
  var ERR = { slug: 'شناسه فقط حروف کوچک انگلیسی، عدد و _ باشد و با حرف شروع شود', name: 'اسم فارسی بین ۲ تا ۶۰ نویسه باشد', duplicate: 'این شناسه قبلاً ساخته شده', not_found: 'پیدا نشد', in_use: 'محصول یا قانون پازلی هنوز در این دسته است؛ اول آن‌ها را به دسته‌ی دیگری ببر', protected: 'این دسته حذف نمی‌شود' };
  function say(r) { toast(ERR[r.body && r.body.error] || 'خطا', true); }
  function refreshMeta() { return api('/admin/meta').then(function (m) { if (m.ok) { S.meta = m.body; applyCategoryNames(); } }); }
  function load() {
    api('/admin/product-categories').then(function (r) {
      if (!r.ok) return fail(r);
      clear(box);
      var rows = r.body.categories.map(function (c) {
        var name = h('input', { type: 'text', value: c.nameFa, maxlength: 60 }), order = h('input', { type: 'number', value: String(c.sortOrder), style: 'width:80px', min: 0, max: 1000 }), on = h('input', { type: 'checkbox' });
        on.checked = c.isActive; if (c.slug === 'other') on.disabled = true;
        return h('div', { class: 'cat-row' }, [
          h('span', { class: 'ltr cat-slug', text: c.slug }), name, order,
          h('label', { class: 'sub' }, [on, ' فعال']),
          badge(fa(c.products) + ' محصول', c.products ? 'b-info' : 'b-mute'),
          h('button', { class: 'btn sm', text: 'ذخیره', onclick: function () {
            api('/admin/product-categories', { method: 'POST', body: { id: c.id, slug: c.slug, nameFa: name.value, sortOrder: Number(order.value) || 0, isActive: on.checked } }).then(function (x) { if (!x.ok) return say(x); toast('ذخیره شد'); refreshMeta().then(load); });
          } }),
          c.slug === 'other' ? h('span', { style: 'width:62px' }) : h('button', { class: 'btn bad sm', text: 'حذف', onclick: function () {
            modal('حذف دسته‌ی «' + c.nameFa + '»؟', h('div', { text: 'فقط وقتی هیچ محصولی در این دسته نیست حذف می‌شود.' }), [{ label: 'انصراف' }, { label: 'حذف', cls: 'bad', keepOpen: true, run: function (close) {
              api('/admin/product-categories/' + c.id, { method: 'DELETE' }).then(function (x) { if (!x.ok) return say(x); close(); toast('حذف شد'); refreshMeta().then(load); });
            } }]);
          } })
        ]);
      });
      rows.forEach(function (x) { box.appendChild(x); });
      var nn = h('input', { type: 'text', placeholder: 'اسم فارسی، مثلاً لوازم‌التحریر', maxlength: 60 }), ns = h('input', { type: 'text', dir: 'ltr', placeholder: 'شناسه‌ی لاتین، مثلاً stationery', maxlength: 40, style: 'max-width:220px' });
      box.appendChild(h('div', { class: 'cat-row cat-new' }, [nn, ns, h('button', { class: 'btn primary', text: '＋ دسته‌ی جدید', onclick: function () {
        var order = r.body.categories.length ? Math.max.apply(null, r.body.categories.map(function (c) { return c.sortOrder; })) + 1 : 1;
        api('/admin/product-categories', { method: 'POST', body: { slug: ns.value, nameFa: nn.value, sortOrder: order, isActive: true } }).then(function (x) { if (!x.ok) return say(x); toast('دسته ساخته شد'); refreshMeta().then(load); });
      } })]));
    });
  }
  load();
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
      if (!r.ok) return fail(r); toast('قیمت ثبت شد؛ برای نمایش در بازی باید تأیید شود');
      p.prices.push({ id: r.body.id, year: Number(yr.value), month: null, priceRials: String(Math.round(t * 10)), sourceType: srcT.value, sourceUrl: srcU.value.trim() || null, sourceNote: note.value.trim() || null, confidence: 1, status: 'pending' });
      p.prices.sort(function (a, b) { return a.year - b.year; });
      yr.value = ''; price.value = ''; srcU.value = ''; note.value = '';
      drawPrices(); route();
    });
  } });
  var body = h('div', { style: 'display:flex;flex-direction:column;gap:16px' }, [
    h('div', { class: 'form-grid' }, [field('نام فارسی', f.nameFa), field('واحد', f.unitFa), field('برند', f.brand), field('دسته', f.category), field('وضعیت تولید', f.status), field('رده‌ی سنی', f.ageTrack), h('label', { class: 'f' }, ['فعال', f.isActive])]),
    field('داستان کوتاه محصول', f.storyFa),
    h('div', {}, [h('div', { text: 'آیکن', style: 'font-weight:700;margin-bottom:6px' }), tile, picker]),
    h('div', {}, [h('div', { text: 'قیمت‌ها', style: 'font-weight:700;margin-bottom:6px' }), h('div', { class: 'm', style: 'color:var(--muted);font-size:13px;margin-bottom:8px', text: rangeText(p) + (p.needsMorePrices ? ' — برای نمایش بازه حداقل چند قیمت در تاریخ‌های مختلف لازم است' : '') }), prices]),
    h('div', {}, [h('div', { text: 'افزودن قیمت دستی', style: 'font-weight:700;margin-bottom:6px' }), h('div', { class: 'form-grid' }, [field('سال شمسی', yr), field('قیمت (تومان)', price), field('نوع منبع', srcT), field('لینک منبع', srcU), field('توضیح منبع', note)]), h('div', { style: 'margin-top:8px;display:flex;gap:8px;flex-wrap:wrap' }, [addBtn, h('button', { class: 'btn', text: '✨ پیشنهاد قیمت با هوش مصنوعی', onclick: function () { aiPriceDialog(p); } })])])
  ]);
  modal(p.nameFa, body, [{ label: 'بستن' }, { label: 'ذخیره', cls: 'primary', keepOpen: true, run: function (close) {
    api('/admin/products/' + p.id, { method: 'PATCH', body: { nameFa: f.nameFa.value.trim(), unitFa: f.unitFa.value.trim() || null, brand: f.brand.value.trim() || null, category: f.category.value, status: f.status.value, ageTrack: f.ageTrack.value, isActive: f.isActive.checked, storyFa: f.storyFa.value.trim() || null, iconKey: icon } }).then(function (r) {
      if (!r.ok) return fail(r); toast('ذخیره شد'); close(); route();
    }); return false; } }]);
}
/* «Fill missing prices»: asks the AI studio for nominal prices in years the product has none for; ticked rows are saved as pending prices. */
function aiPriceDialog(p) {
  var provider = select([['', 'در حال بارگذاری…']], ''), model = select([['', 'پیش‌فرض سرویس']], '');
  var hint = h('textarea', { placeholder: 'توضیح اضافه برای هوش مصنوعی (اختیاری): برند، اندازه، شهر…', maxlength: 300 });
  var from = h('input', { type: 'number', min: 1300, max: 1450, value: 1350 }), to = h('input', { type: 'number', min: 1300, max: 1450, value: 1405 });
  var out = h('div'), rows = [], saving = false;
  var go = h('button', { class: 'btn primary', text: 'بگیر', disabled: true });
  api('/admin/ai').then(function (r) {
    if (!r.ok) return out.appendChild(banner('warn', 'استودیوی هوش مصنوعی روی این سرور فعال نیست.'));
    if (!r.body.providers.length) return out.appendChild(banner('warn', AI_ERR.ai_not_configured));
    clear(provider);
    r.body.providers.forEach(function (x) { provider.appendChild(h('option', { value: x.id, text: x.label })); });
    var lastProvider = load('ai.provider');
    if (lastProvider && r.body.providers.some(function (x) { return x.id === lastProvider; })) provider.value = lastProvider;
    aiModelPicker(provider, model, function () { return r.body.providers; })();
    go.disabled = false;
  });
  function show(list) {
    clear(out); rows = [];
    if (!list.length) return out.appendChild(empty('پیشنهادی برای سال‌های خالی نیامد'));
    out.appendChild(h('div', { class: 'm', style: 'color:var(--muted);font-size:13px;margin:8px 0', text: 'قیمت‌ها (تومان، اسمی) را بازبینی و اصلاح کن؛ تیک‌خورده‌ها «در انتظار تأیید» ثبت می‌شوند.' }));
    list.forEach(function (x) {
      var chk = h('input', { type: 'checkbox', checked: true }), val = h('input', { type: 'number', min: 1, value: x.priceToman, style: 'max-width:180px' });
      rows.push({ year: x.year, chk: chk, val: val });
      out.appendChild(h('label', { style: 'display:flex;gap:10px;align-items:center;margin:4px 0' }, [chk, h('span', { class: 'num', text: fa(x.year), style: 'min-width:48px' }), val]));
    });
  }
  go.onclick = function () {
    go.disabled = true; clear(out); out.appendChild(h('div', { class: 'm', text: 'در حال گرفتن پیشنهاد…', style: 'color:var(--muted)' }));
    api('/admin/ai/product-prices', { method: 'POST', body: { provider: provider.value, model: model.value.trim() || undefined, productId: p.id, hint: hint.value.trim() || undefined, fromYear: Number(from.value) || undefined, toYear: Number(to.value) || undefined } }).then(function (r) {
      go.disabled = false; clear(out);
      if (!r.ok) return out.appendChild(banner('warn', aiErrorText(r.body, 'گرفتن پیشنهاد ناموفق بود.')));
      show(r.body.prices);
    });
  };
  var close = modal('پیشنهاد قیمت — ' + p.nameFa, h('div', { style: 'display:flex;flex-direction:column;gap:12px' }, [
    h('div', { class: 'form-grid' }, [field('سرویس', provider), field('مدل', model), field('از سال', from), field('تا سال', to)]),
    field('توضیح اضافه', hint), h('div', {}, [go]), out
  ]), [{ label: 'بستن' }, { label: 'ثبت تیک‌خورده‌ها', cls: 'primary', keepOpen: true, run: function (done) {
    var picked = rows.filter(function (x) { return x.chk.checked && Number(x.val.value) > 0; });
    if (!picked.length || saving) return false;
    saving = true;
    var ok = 0, i = 0;
    (function next() {
      if (i >= picked.length) { saving = false; toast(fa(ok) + ' قیمت ثبت شد؛ برای نمایش در بازی باید تأیید شود'); done(); route(); return; }
      var x = picked[i++];
      api('/admin/prices', { method: 'POST', body: { productId: p.id, year: x.year, priceRials: String(Math.round(Number(x.val.value) * 10)), sourceType: 'other', sourceUrl: null, sourceNote: 'AI-suggested, unverified' } }).then(function (r) { if (r.ok) ok++; next(); });
    })();
    return false; } }]);
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
