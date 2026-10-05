/** Admin panel views: Puzzles, user reports, suggestions (UGC) (browser JS, concatenated into one script by ../views2.ts). */
export const ADMIN_VIEWS2_PUZZLES_JS = String.raw`VIEWS.puzzles = function (root) {
  var LEVELS = [['آسان', '#f5c542', 'زرد'], ['متوسط', '#6cc24a', 'سبز'], ['سخت', '#3fa5e0', 'آبی'], ['خیلی سخت', '#9b59d0', 'بنفش']];
  var P = { prods: [], byId: {}, rows: [], tab: 'draft', ready: null, tiers: [] };
  var B = { slots: [[], [], [], []], titles: ['', '', '', ''], expls: ['', '', '', ''], active: 0, q: '', cat: 'all', tier: '', track: 'adult' };
  var TRACK_RANK = { kid: 0, teen: 1, adult: 2 };
  var head = h('div'), body = h('div');
  function yearsOf(p) {
    var ys = (p.prices || []).filter(function (x) { return x.status === 'approved'; }).map(function (x) { return x.year; });
    return ys.length ? fa(Math.min.apply(null, ys)) + '–' + fa(Math.max.apply(null, ys)) : 'بدون قیمت';
  }
  function chip(p, onclick, extra) {
    return h('button', { type: 'button', class: 'pchip' + (extra ? ' ' + extra : ''), onclick: onclick, title: p.nameFa }, [iconTile(p.iconKey), h('span', { text: p.nameFa })]);
  }
  function tierLabel(t) { return t.nameFa + ' (لول ' + fa(t.minLevel) + (t.maxLevel === null ? ' به بالا' : ' تا ' + fa(t.maxLevel)) + ')'; }
  function tierOpts() { return [['', '— بدون سطح —']].concat(P.tiers.map(function (t) { return [t.id, tierLabel(t)]; })); }
  function drawTiers(tierBoxEl) {
    var rows = P.tiers.map(function (t) {
      var name = h('input', { value: t.nameFa, style: 'width:140px' });
      var order = h('input', { type: 'number', value: String(t.sortOrder), style: 'width:64px', title: 'ترتیب (کوچک‌تر = آسان‌تر)' });
      var min = h('input', { type: 'number', min: '1', value: String(t.minLevel), style: 'width:64px', title: 'از لول' });
      var max = h('input', { type: 'number', min: '1', value: t.maxLevel === null ? '' : String(t.maxLevel), placeholder: 'بی‌نهایت', style: 'width:84px', title: 'تا لول (خالی = بدون سقف)' });
      return h('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:6px 0;border-bottom:1px solid var(--line)' }, [
        name, h('span', { class: 'muted', text: 'ترتیب' }), order, h('span', { class: 'muted', text: 'از لول' }), min, h('span', { class: 'muted', text: 'تا لول' }), max,
        h('button', { class: 'btn ok sm', text: 'ذخیره', onclick: function () {
          api('/admin/puzzles/tiers', { method: 'POST', body: { id: t.id, nameFa: name.value, sortOrder: Number(order.value), minLevel: Number(min.value), maxLevel: max.value === '' ? null : Number(max.value) } }).then(function (r) {
            if (!r.ok) return r.body && r.body.error === 'level_range' ? toast('بازه‌ی لول درست نیست (سقف نباید از شروع کمتر باشد)', true) : r.body && r.body.error === 'name' ? toast('اسم سطح را بنویس', true) : fail(r);
            toast('ذخیره شد'); reload();
          });
        } }),
        h('button', { class: 'btn bad sm', text: 'حذف', onclick: function () {
          if (!confirm('سطح «' + t.nameFa + '» حذف شود؟ پازل‌های این سطح بدون سطح می‌شوند.')) return;
          api('/admin/puzzles/tiers/' + t.id, { method: 'DELETE' }).then(function (r) { r.ok ? (toast('حذف شد'), reload()) : fail(r); });
        } })
      ]);
    });
    var nn = h('input', { placeholder: 'اسم سطح تازه', style: 'width:140px' });
    var nmin = h('input', { type: 'number', min: '1', value: '1', style: 'width:64px' });
    var nmax = h('input', { type: 'number', min: '1', placeholder: 'بی‌نهایت', style: 'width:84px' });
    var add = h('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding-top:8px' }, [
      nn, h('span', { class: 'muted', text: 'از لول' }), nmin, h('span', { class: 'muted', text: 'تا لول' }), nmax,
      h('button', { class: 'btn', text: 'افزودن سطح', onclick: function () {
        var order = P.tiers.length ? Math.max.apply(null, P.tiers.map(function (t) { return t.sortOrder; })) + 1 : 1;
        api('/admin/puzzles/tiers', { method: 'POST', body: { nameFa: nn.value, sortOrder: order, minLevel: Number(nmin.value) || 1, maxLevel: nmax.value === '' ? null : Number(nmax.value) } }).then(function (r) {
          if (!r.ok) return r.body && r.body.error === 'level_range' ? toast('بازه‌ی لول درست نیست', true) : r.body && r.body.error === 'name' ? toast('اسم سطح را بنویس', true) : fail(r);
          toast('سطح اضافه شد'); reload();
        });
      } })
    ]);
    tierBoxEl.appendChild(card('سطح‌بندی پازل‌ها', 'هر پازل را در یک سطح بگذار؛ بازیکن‌های لول پایین پازل‌های سطح آسان‌تر می‌گیرند. در دوئل، لولِ بالاترین بازیکن تعیین می‌کند. پازلِ بدون سطح فقط وقتی پخش می‌شود که پازل هم‌سطحی نباشد.', rows.concat([add])));
  }
  function setTab(t) { P.tab = t; draw(); }
  function drawHead() {
    clear(head);
    var r = P.ready, rows = P.rows;
    var cnt = { draft: 0, approved: 0, retired: 0 };
    rows.forEach(function (x) { cnt[x.status]++; });
    var tabs = [['draft', 'پیش‌نویس‌ها', cnt.draft], ['approved', 'فعال (قابل بازی)', cnt.approved], ['retired', 'بازنشسته', cnt.retired], ['new', '＋ ساخت پازل جدید', 0], ['tiers', 'سطح‌بندی', 0]];
    head.appendChild(h('div', { class: 'tabs' }, tabs.map(function (t) {
      return h('button', { class: 'tab', 'aria-selected': String(P.tab === t[0]), onclick: function () { setTab(t[0]); } }, [t[1], t[2] ? h('span', { class: 'count', text: fa(t[2]) }) : null]);
    })));
    if (r && r.products < r.productsPerPuzzle) head.appendChild(h('div', { class: 'callout warn', text: 'برای ساخت پازل ' + fa(r.productsPerPuzzle) + ' کالا لازم است و فقط ' + fa(r.products) + ' کالا در کاتالوگ هست؛ اول از «کاتالوگ محصولات» کالا اضافه کن.' }));
  }
  /* ---------- preview card of an existing puzzle ---------- */
  function puzzleCard(p) {
    var inputs = p.groups.map(function (g) { return h('input', { value: g.titleFa || '', placeholder: 'عنوان دسته (اجباری برای تأیید)' }); });
    function save(then) {
      var titles = [];
      for (var i = 0; i < p.groups.length; i++) {
        var v = inputs[i].value.trim();
        if (v.length < 2) { toast('عنوان دسته‌ی ' + LEVELS[p.groups[i].level][2] + ' را بنویس', true); inputs[i].focus(); return; }
        titles.push({ level: p.groups[i].level, titleFa: v });
      }
      api('/admin/puzzles/' + p.id + '/titles', { method: 'PUT', body: { titles: titles } }).then(function (r) { if (!r.ok) return fail(r); then ? then() : (toast('عنوان‌ها ذخیره شد'), reload()); });
    }
    function status(st, msg) { api('/admin/puzzles/' + p.id, { method: 'PATCH', body: { status: st } }).then(function (r) { if (!r.ok) return fail(r); toast(msg); reload(); }); }
    var groups = p.groups.slice().sort(function (a, b) { return a.level - b.level; }).map(function (g) {
      var lv = LEVELS[g.level] || LEVELS[0], idx = p.groups.indexOf(g);
      return h('div', { class: 'pz-group', style: '--lv:' + lv[1] }, [
        inputs[idx],
        h('div', { class: 'pz-items' }, g.items.map(function (n) { return h('span', { class: 'pz-item', text: n }); }))
      ]);
    });
    var actions = p.status === 'draft' ? [
      h('button', { class: 'btn primary', text: 'ذخیره و تأیید', onclick: function () { save(function () { status('approved', 'پازل تأیید شد و قابل بازی است'); }); } }),
      h('button', { class: 'btn', text: 'فقط ذخیره‌ی عنوان‌ها', onclick: function () { save(); } }),
      h('button', { class: 'btn bad', text: 'دور بریز', onclick: function () { status('retired', 'پازل دور ریخته شد'); } })
    ] : p.status === 'approved' ? [
      h('button', { class: 'btn', text: 'ذخیره‌ی عنوان‌ها', onclick: function () { save(); } }),
      h('button', { class: 'btn bad', text: 'بازنشسته کن', onclick: function () { status('retired', 'پازل بازنشسته شد'); } })
    ] : [h('button', { class: 'btn ok', text: 'دوباره فعال کن', onclick: function () { status('approved', 'پازل دوباره فعال شد'); } })];
    var tierPick = select(tierOpts(), p.tierId || '');
    tierPick.onchange = function () {
      api('/admin/puzzles/' + p.id + '/tier', { method: 'PUT', body: { tierId: tierPick.value || null } }).then(function (r) { r.ok ? toast('سطح پازل ذخیره شد') : fail(r); });
    };
    return h('div', { class: 'card pz' }, [
      h('div', { class: 'pz-head' }, [badge(p.source === 'generated' ? 'ساخته‌ی خودکار' : 'دستی', 'b-info'), h('span', { class: 'sub', text: ago(p.createdAt) }), h('span', { style: 'flex:1' }), h('span', { class: 'sub', text: 'سطح:' }), tierPick]),
      h('div', { class: 'pz-groups' }, groups),
      h('div', { class: 'actions' }, actions)
    ]);
  }
  function drawList() {
    var rows = P.rows.filter(function (x) { return x.status === P.tab; });
    var box = h('div');
    if (P.tab === 'draft') {
      var n = h('input', { type: 'number', min: '1', max: '20', value: '5', style: 'width:84px' });
      box.appendChild(h('div', { class: 'card inline' }, [
        h('div', { style: 'flex:1;min-width:220px' }, [h('b', { text: 'ساخت خودکار' }), h('div', { class: 'sub', text: 'سیستم پازل یکتا و معتبر می‌سازد؛ تو فقط عنوان دسته‌ها را می‌نویسی و تأیید می‌کنی.' })]),
        n,
        h('button', { class: 'btn primary', text: 'بساز', onclick: function () {
          api('/admin/puzzles/generate', { method: 'POST', body: { count: Number(n.value) || 1 } }).then(function (r) {
            if (!r.ok) return fail(r);
            toast(r.body.created ? fa(r.body.created) + ' پیش‌نویس ساخته شد' : 'پازلی ساخته نشد؛ کاتالوگ (' + fa(r.body.catalogSize) + ' کالای دارای قیمت) کم است', !r.body.created);
            reload();
          });
        } })
      ]));
    }
    if (!rows.length) box.appendChild(card('', '', [empty(P.tab === 'draft' ? 'پیش‌نویسی نیست؛ بالا بساز یا دستی بساز' : 'موردی نیست')]));
    else box.appendChild(h('div', { class: 'pz-grid' }, rows.map(puzzleCard)));
    return box;
  }
  /* ---------- the builder ---------- */
  function usedIds() { var u = {}; B.slots.forEach(function (g) { g.forEach(function (id) { u[id] = true; }); }); return u; }
  function filled() { return B.slots.reduce(function (n, g) { return n + g.length; }, 0); }
  function place(id) {
    var used = usedIds();
    if (used[id]) return;
    var order = [B.active, 0, 1, 2, 3];
    for (var k = 0; k < order.length; k++) {
      var gi = order[k];
      if (B.slots[gi].length < 4) { B.slots[gi].push(id); if (B.slots[B.active].length >= 4) { for (var j = 0; j < 4; j++) if (B.slots[j].length < 4) { B.active = j; break; } } return drawBuilder(); }
    }
    toast('هر ۱۶ جایگاه پر است', true);
  }
  function drawBuilder() {
    var keep = body.querySelector('.picker-list') ? body.querySelector('.picker-list').scrollTop : 0;
    clear(body);
    var used = usedIds(), n = filled();
    var cols = h('div', { class: 'bd-groups' }, LEVELS.map(function (lv, gi) {
      var t = h('input', { value: B.titles[gi], placeholder: 'عنوان بامزه‌ی دسته', oninput: function () { B.titles[gi] = t.value; refreshSubmit(); } });
      var ex = h('input', { value: B.expls[gi], placeholder: 'توضیح قانون (اختیاری؛ اگر خالی بماند همان عنوان می‌شود)', oninput: function () { B.expls[gi] = ex.value; } });
      var slots = [0, 1, 2, 3].map(function (si) {
        var id = B.slots[gi][si], p = id && P.byId[id];
        return p ? h('button', { type: 'button', class: 'slot full', title: 'برای برداشتن بزن', onclick: function () { B.slots[gi].splice(si, 1); B.active = gi; drawBuilder(); } }, [p.iconKey ? iconTile(p.iconKey) : null, h('span', { text: p.nameFa }), h('i', { text: '×' })])
          : h('button', { type: 'button', class: 'slot', onclick: function () { B.active = gi; drawBuilder(); } }, [h('span', { text: B.active === gi && si === B.slots[gi].length ? 'کالا را از فهرست بزن' : '＋' })]);
      });
      return h('div', { class: 'bd-group' + (B.active === gi ? ' active' : ''), style: '--lv:' + lv[1], onclick: function () { if (B.active !== gi) { B.active = gi; drawBuilder(); } } }, [
        h('div', { class: 'bd-lv' }, [h('b', { text: lv[2] + ' · ' + lv[0] }), h('span', { class: 'sub', text: fa(B.slots[gi].length) + '/۴' })]),
        t, ex, h('div', { class: 'slots' }, slots)
      ]);
    }));
    var term = B.q.trim();
    var cats = {}; P.prods.forEach(function (p) { if (p.category) cats[p.category] = true; });
    var q = h('input', { type: 'search', placeholder: 'جستجوی کالا…', value: B.q, oninput: function () { B.q = q.value; drawList2(); } });
    var catSel = select([['all', 'همه‌ی دسته‌ها']].concat(Object.keys(cats).map(function (c) { return [c, CAT_FA[c] || c]; })), B.cat);
    catSel.addEventListener('change', function () { B.cat = catSel.value; drawList2(); });
    var list = h('div', { class: 'picker-list' });
    function drawList2() {
      clear(list);
      var t = B.q.trim(), u = usedIds();
      var rows = P.prods.filter(function (p) { return !u[p.id] && (TRACK_RANK[p.ageTrack || 'adult'] <= TRACK_RANK[B.track]) && (B.cat === 'all' || p.category === B.cat) && (!t || (p.nameFa + ' ' + p.slug).indexOf(t) >= 0); });
      if (!rows.length) list.appendChild(empty('کالایی پیدا نشد'));
      rows.forEach(function (p) {
        list.appendChild(h('button', { type: 'button', class: 'pick', onclick: function () { place(p.id); } }, [p.iconKey ? iconTile(p.iconKey) : null, h('span', { class: 'pn' }, [h('b', { text: p.nameFa }), h('small', { text: (CAT_FA[p.category] || '') + ' · ' + yearsOf(p) })])]));
      });
    }
    var tierSel = select(tierOpts(), B.tier); tierSel.onchange = function () { B.tier = tierSel.value; };
    var trackSel = select([['adult', 'پازل بزرگسال'], ['teen', 'پازل نوجوان'], ['kid', 'پازل کودک']], B.track); trackSel.onchange = function () { B.track = trackSel.value; drawBuilder(); };
    var submit = h('button', { class: 'btn primary', text: 'ساخت پازل', onclick: submitPuzzle });
    function refreshSubmit() { submit.disabled = !(filled() === 16 && B.titles.every(function (x) { return x.trim().length >= 2; })); }
    var bar = h('div', { class: 'bd-bar' }, [
      h('div', { class: 'progress' }, [h('i', { style: 'width:' + (n / 16 * 100) + '%' })]),
      h('span', { class: 'sub', text: fa(n) + ' از ۱۶ کالا' }),
      h('span', { style: 'flex:1' }), trackSel, tierSel,
      h('button', { class: 'btn', text: 'پاک‌کردن همه', onclick: function () { B.slots = [[], [], [], []]; B.titles = ['', '', '', '']; B.expls = ['', '', '', '']; B.active = 0; drawBuilder(); } }),
      submit
    ]);
    body.appendChild(h('div', { class: 'bd' }, [
      h('div', { class: 'bd-main' }, [h('div', { class: 'callout', text: 'یک دسته را انتخاب کن (کادر رنگی)، بعد کالاها را از فهرست کناری بزن تا خودکار در همان دسته بنشینند. هر کالا فقط یک بار می‌آید و باید فقط به یک دسته بخورد.' }), cols, bar]),
      h('aside', { class: 'bd-side' }, [h('b', { text: 'کالاها' }), q, catSel, list])
    ]));
    drawList2(); refreshSubmit();
    var nl = body.querySelector('.picker-list'); if (nl) nl.scrollTop = keep;
  }
  function submitPuzzle() {
    var groups = LEVELS.map(function (lv, i) { var t = B.titles[i].trim(); return { level: i, titleFa: t, explanationFa: B.expls[i].trim().length >= 2 ? B.expls[i].trim() : t, productIds: B.slots[i].slice() }; });
    api('/admin/puzzles', { method: 'POST', body: { groups: groups, tierId: B.tier || null, ageTrack: B.track } }).then(function (r) {
      if (!r.ok) return r.body && r.body.error === 'duplicate_product' ? toast('یک کالا نباید دو بار در پازل بیاید', true) : fail(r);
      toast('پازل ساخته شد و قابل بازی است');
      B.slots = [[], [], [], []]; B.titles = ['', '', '', '']; B.expls = ['', '', '', '']; B.active = 0;
      P.tab = 'approved'; reload();
    });
  }
  function draw() { drawHead(); clear(body); if (P.tab === 'new') drawBuilder(); else if (P.tab === 'tiers') { var tb = h('div'); drawTiers(tb); body.appendChild(tb); } else body.appendChild(drawList()); }
  function reload() {
    api('/admin/puzzles').then(function (r) {
      if (r.status === 404) { clear(root); return root.appendChild(empty('بخش پازل روی این سرور فعال نیست')); }
      if (!r.ok) return fail(r);
      P.tiers = r.body.tiers || []; P.ready = r.body.readiness; P.rows = r.body.puzzles; draw();
    });
  }
  root.appendChild(head); root.appendChild(body);
  api('/admin/catalog').then(function (r) {
    if (!r.ok) return fail(r);
    P.prods = r.body.products.filter(function (p) { return p.isActive !== false; });
    P.prods.forEach(function (p) { P.byId[p.id] = p; });
    reload();
  });
};

VIEWS.userreports = function (root) {
  var list = h('div');
  var CAT = { abuse: 'توهین و فحاشی', spam: 'اسپم', cheating: 'تقلب', bad_name: 'اسم یا عکس نامناسب', other: 'دیگر' };
  function draw() {
    api('/admin/user-reports').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('گزارش بازیکن روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      if (!r.body.reports.length) return list.appendChild(empty('گزارشی نیست'));
      r.body.reports.forEach(function (x) {
        list.appendChild(h('div', { class: 'kv' }, [
          h('span', { text: x.targetName + ' ← ' + x.reporterName }),
          h('span', { style: 'color:var(--muted);font-size:12px', text: (CAT[x.category] || x.category) + (x.details ? ' · ' + x.details : '') + ' · ' + ago(x.createdAt) }),
          x.resolved ? badge('بررسی شد', 'b-ok') : h('button', { class: 'btn sm', text: 'بررسی شد', onclick: function () { api('/admin/user-reports/' + x.id + '/resolve', { method: 'POST' }).then(function (y) { if (!y.ok) return fail(y); draw(); }); } })]));
      });
    });
  }
  root.appendChild(card('گزارش بازیکن‌ها', 'گزارش از پروفایل بازیکن؛ برای اقدام از «کاربران» اخطار یا سکوت بده.', [list]));
  draw();
};
VIEWS.ugc = function (root) {
  var list = h('div');
  var status = select([['', 'همه'], ['ready_for_review', 'منتظر تأیید مدیر'], ['pending', 'در حال رأی‌گیری'], ['approved', 'تأییدشده'], ['rejected', 'ردشده']], 'ready_for_review');
  var KIND = { item: 'کالای تازه', price_point: 'قیمت تازه', price_report: 'گزارش قیمت' };
  var SRC = { website: 'لینک', user_memory: 'یادمه', other: 'دیگر' };
  var STATE = { pending: 'رأی‌گیری', ready_for_review: 'منتظر مدیر', approved: 'تأیید شد', rejected: 'رد شد' };
  function draw() {
    api('/admin/ugc' + (status.value ? '?status=' + status.value : '')).then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('پیشنهاد بازیکن روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      if (!r.body.submissions.length) return list.appendChild(empty('پیشنهادی نیست'));
      r.body.submissions.forEach(function (x) {
        var price = x.priceRials === null ? '' : ' · ' + Number(x.priceRials / 10).toLocaleString('fa-IR') + ' تومان';
        var open = x.status === 'pending' || x.status === 'ready_for_review';
        list.appendChild(h('div', { class: 'kv' }, [
          h('span', { text: (KIND[x.kind] || x.kind) + ': ' + x.nameFa + (x.year ? ' · ' + x.year : '') + price }),
          h('span', { style: 'color:var(--muted);font-size:12px', text: x.userName + ' · ' + (SRC[x.sourceType] || '') + (x.sourceText ? ': ' + x.sourceText : '') + (x.note ? ' · ' + x.note : '') + ' · امتیاز ' + x.score + ' · ' + ago(x.createdAt) }),
          open ? h('button', { class: 'btn sm', text: 'تأیید', onclick: function () { api('/admin/ugc/' + x.id + '/approve', { method: 'POST' }).then(function (y) { if (!y.ok) return fail(y); toast(x.kind === 'price_report' ? 'تأیید شد؛ قیمت را در «کاتالوگ» اصلاح کن' : 'به بازبینی کاتالوگ رفت'); draw(); }); } }) : badge(STATE[x.status] || x.status, x.status === 'approved' ? 'b-ok' : ''),
          open ? h('button', { class: 'btn bad sm', text: 'رد', onclick: function () { api('/admin/ugc/' + x.id + '/reject', { method: 'POST' }).then(function (y) { if (!y.ok) return fail(y); draw(); }); } }) : null]));
      });
    });
  }
  status.onchange = draw;
  root.appendChild(card('پیشنهاد قیمت و کالا', 'تأیید یک کالا یا قیمت آن را به «بازبینی قیمت‌ها» می‌فرستد و به پیشنهاددهنده سکه می‌دهد (مقدار در «تنظیمات»).', [h('div', { class: 'row' }, [status]), list]));
  draw();
};
`;
