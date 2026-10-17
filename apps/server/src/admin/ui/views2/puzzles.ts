/** Admin panel views: Puzzles, user reports, suggestions (UGC) (browser JS, concatenated into one script by ../views2.ts). */
export const ADMIN_VIEWS2_PUZZLES_JS = String.raw`VIEWS.puzzles = function (root) {
  var LEVELS = [['آسان', '#f5c542', 'زرد'], ['متوسط', '#6cc24a', 'سبز'], ['سخت', '#3fa5e0', 'آبی'], ['خیلی سخت', '#9b59d0', 'بنفش']];
  var P = { prods: [], byId: {}, rows: [], tab: 'draft', ready: null, tiers: [], track: '', topicF: '', tagF: '', tierF: '', revF: '', topics: [], tags: [], genTags: [] };
  var R = { i: 0, status: '', rev: 'no' };
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
  function when(ms) {
    try { return new Date(ms).toLocaleString('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ago(ms); }
  }
  function revOpts(allLabel) { return [['', allLabel], ['no', 'بازبینی نشده'], ['yes', 'بازبینی شده']]; }
  function revOk(x, v) { return !v || (v === 'no' ? !x.reviewedAt : !!x.reviewedAt); }
  /* The shared filters (age band, group, tag, level); status and review state are per tab. */
  function matches(x) {
    return (!P.track || (x.ageTrack || 'adult') === P.track) && (!P.topicF || (P.topicF === '-' ? !x.topicId : x.topicId === P.topicF)) &&
      (!P.tagF || (x.tags || []).indexOf(P.tagF) >= 0) && (!P.tierF || (P.tierF === '-' ? !x.tierId : x.tierId === P.tierF));
  }
  function filterSelects() {
    var revFilter = select(revOpts('همه‌ی وضعیت‌های بازبینی'), P.revF);
    revFilter.onchange = function () { P.revF = revFilter.value; draw(); };
    box.appendChild(h('div', { class: 'toolbar pz-filters' }, [h('span', { class: 'sub', text: 'فیلتر' })].concat(filterSelects(), [revFilter, h('span', { style: 'flex:1' }), h('span', { class: 'badge b-info', text: fa(rows.length) + ' پازل' }),
      h('button', { class: 'btn', text: '🤖 دستیار بازبینی', title: 'پازل‌های همین فیلتر را بخواند و اگر لازم بود ویرایش و پیش‌نویس کند', onclick: function () { openAssistant(rows); } })])));
    if (P.tab === 'draft') {
      var n = h('input', { type: 'number', min: '1', max: '20', value: '5', style: 'width:84px' });
      var genTier = select([['', 'همه‌ی سطح‌ها، به نوبت']].concat(P.tiers.map(function (t) { return [t.id, tierLabel(t)]; })), '');
      var genTopic = select([['', '— بدون گروه —']].concat(P.topics.filter(function (t) { return t.isActive; }).map(function (t) { return [t.id, t.nameFa]; })), '');
      var genChips = h('div', { class: 'chips' });
      var drawGenChips = function () {
        clear(genChips);
        P.tags.filter(function (t) { return t.isActive; }).forEach(function (t) {
          var on = P.genTags.indexOf(t.slug) >= 0;
          genChips.appendChild(h('button', { type: 'button', class: 'btn sm' + (on ? ' primary' : ''), 'aria-pressed': String(on), text: t.nameFa, onclick: function () {
            P.genTags = on ? P.genTags.filter(function (x) { return x !== t.slug; }) : P.genTags.concat([t.slug]); drawGenChips();
          } }));
        });
      };
      drawGenChips();
      box.appendChild(h('div', { class: 'card inline' }, [
        h('div', { style: 'flex:1;min-width:220px' }, [h('b', { text: 'ساخت خودکار' }), h('div', { class: 'sub', text: 'با زدن این دکمه برای سطح، گروه و برچسب‌های انتخابی پازل پیش‌نویس می‌سازد؛ تا تأیید تو منتشر نمی‌شوند. (ساخت زمان‌بندی‌شده را از «تنظیمات» خاموش کن.)' })]),
        genTier,
        genTopic,
        genChips,
        n,
        h('button', { class: 'btn primary', text: 'بساز', onclick: function () {
          var body = { count: Number(n.value) || 1 };
          if (genTier.value) body.tierId = genTier.value;
          if (genTopic.value) body.topicId = genTopic.value;
          if (P.genTags.length) body.tags = P.genTags;
          api('/admin/puzzles/generate', { method: 'POST', body: body }).then(function (r) {
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
  /* ---------- review tab: one puzzle at a time, built for a phone ---------- */
  function drawReview() {
    var rows = P.rows.filter(function (x) { return (R.status ? x.status === R.status : x.status !== 'retired') && matches(x) && revOk(x, R.rev); });
    /* Never-reviewed first, then the longest since the last review; marking one moves it to the back, so the same index shows the next. */
    rows.sort(function (a, b) { return (a.reviewedAt || 0) - (b.reviewedAt || 0); });
    if (R.i >= rows.length) R.i = Math.max(0, rows.length - 1);
    var box = h('div', { class: 'rv-tab' });
    var st = select([['', 'فعال و پیش‌نویس'], ['approved', 'فقط فعال'], ['draft', 'فقط پیش‌نویس'], ['retired', 'فقط بازنشسته']], R.status);
    st.onchange = function () { R.status = st.value; R.i = 0; draw(); };
    var rv = select(revOpts('بازبینی‌شده و نشده'), R.rev);
    rv.onchange = function () { R.rev = rv.value; R.i = 0; draw(); };
    box.appendChild(h('div', { class: 'toolbar pz-filters' }, [h('span', { class: 'sub', text: 'فیلتر' }), rv, st].concat(filterSelects(), [h('span', { style: 'flex:1' }), h('span', { class: 'badge b-info', text: fa(rows.length) + ' پازل' })])));
    if (!rows.length) { box.appendChild(card('', '', [empty(R.rev === 'no' ? 'همه‌ی پازل‌های این فیلتر بازبینی شده‌اند 🎉' : 'موردی نیست')])); return box; }
    var p = rows[R.i], pc = puzzleCard(p);
    function go(d) { R.i = Math.min(rows.length - 1, Math.max(0, R.i + d)); draw(); window.scrollTo(0, 0); }
    box.appendChild(pc);
    box.appendChild(h('div', { class: 'rv-bar' }, [
      h('button', { class: 'btn', text: '→ قبلی', disabled: R.i === 0, onclick: function () { go(-1); } }),
      h('span', { class: 'rv-pos', text: fa(R.i + 1) + ' از ' + fa(rows.length) }),
      h('button', { class: 'btn ok', text: p.reviewedAt ? 'بازبینی مجدد ✓' : 'بازبینی شد ✓', onclick: function () { pc.reviewNow(); } }),
      h('button', { class: 'btn', text: 'بعدی ←', disabled: R.i >= rows.length - 1, onclick: function () { go(1); } })
    ]));
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
  function drawTopics(box) {
    var rows = P.topics.map(function (t) {
      var name = h('input', { value: t.nameFa }), slug = h('input', { value: t.slug, style: 'width:120px', dir: 'ltr' }), order = h('input', { type: 'number', value: String(t.sortOrder), style: 'width:70px' }), active = h('input', { type: 'checkbox' });
      active.checked = t.isActive;
      return h('div', { class: 'toolbar' }, [name, slug, order, h('label', { class: 'sub' }, [active, ' فعال']), badge(fa(t.puzzles) + ' پازل فعال', t.puzzles >= 3 ? 'b-ok' : 'b-warn'),
        h('button', { class: 'btn sm', text: 'ذخیره', onclick: function () {
          api('/admin/puzzle-topics', { method: 'POST', body: { id: t.id, slug: slug.value, nameFa: name.value, sortOrder: Number(order.value) || 0, isActive: active.checked } }).then(function (r) { r.ok ? (toast('ذخیره شد'), reload()) : fail(r); });
        } })]);
    });
    var nn = h('input', { placeholder: 'نام موضوع، مثلا خوراکی' }), ns = h('input', { placeholder: 'نام لاتین، مثلا food', style: 'width:120px', dir: 'ltr' });
    var add = h('div', { class: 'toolbar' }, [nn, ns, h('button', { class: 'btn primary sm', text: '＋ موضوع جدید', onclick: function () {
      var order = P.topics.length ? Math.max.apply(null, P.topics.map(function (t) { return t.sortOrder; })) + 1 : 1;
      api('/admin/puzzle-topics', { method: 'POST', body: { slug: ns.value, nameFa: nn.value, sortOrder: order, isActive: true } }).then(function (r) { r.ok ? (toast('موضوع ساخته شد'), reload()) : fail(r); });
    } })]);
    var tagRows = P.tags.map(function (t) {
      var name = h('input', { value: t.nameFa }), slug = h('input', { value: t.slug, style: 'width:120px', dir: 'ltr' }), order = h('input', { type: 'number', value: String(t.sortOrder), style: 'width:70px' }), active = h('input', { type: 'checkbox' });
      active.checked = t.isActive;
      return h('div', { class: 'toolbar' }, [name, slug, order, h('label', { class: 'sub' }, [active, ' فعال']), badge(fa(t.puzzles) + ' پازل', 'b-info'),
        h('button', { class: 'btn sm', text: 'ذخیره', onclick: function () {
          api('/admin/puzzle-tags', { method: 'POST', body: { id: t.id, slug: slug.value, nameFa: name.value, sortOrder: Number(order.value) || 0, isActive: active.checked } }).then(function (r) { r.ok ? (toast('ذخیره شد'), reload()) : fail(r); });
        } })]);
    });
    var tn = h('input', { placeholder: 'نام برچسب، مثلا نوستالژی' }), ts = h('input', { placeholder: 'نام لاتین، مثلا nostalgia', style: 'width:140px', dir: 'ltr' });
    var tagAdd = h('div', { class: 'toolbar' }, [tn, ts, h('button', { class: 'btn primary sm', text: '＋ برچسب جدید', onclick: function () {
      var order = P.tags.length ? Math.max.apply(null, P.tags.map(function (t) { return t.sortOrder; })) + 1 : 1;
      api('/admin/puzzle-tags', { method: 'POST', body: { slug: ts.value, nameFa: tn.value, sortOrder: order, isActive: true } }).then(function (r) { r.ok ? (toast('برچسب ساخته شد'), reload()) : fail(r); });
    } })]);
    box.appendChild(card('برچسب‌های پازل', 'فهرست برچسب‌ها را اینجا تعریف می‌کنی؛ روی کارت هر پازل (و در ربات هوشمند) فقط از همین فهرست انتخاب می‌شود، نه تایپ آزاد.', tagRows.concat([tagAdd])));
    box.appendChild(card('موضوع‌های پازل', 'هر پازل را روی کارتش در یک موضوع بگذار. در دوئل و میزِ دور ۳ به بالا، طرف‌ها موضوع هر دور را از بین موضوع‌هایی انتخاب می‌کنند که دست‌کم ۳ پازل فعال دارند.', rows.concat([add])));
  }
  function draw() { drawHead(); clear(body); if (P.tab === 'topics') { var tp = h('div'); drawTopics(tp); body.appendChild(tp); } else if (P.tab === 'review') body.appendChild(drawReview()); else if (P.tab === 'new') drawBuilder(); else if (P.tab === 'tiers') { var tb = h('div'); drawTiers(tb); body.appendChild(tb); } else body.appendChild(drawList()); }
  function reload() {
    api('/admin/puzzles').then(function (r) {
      if (r.status === 404) { clear(root); return root.appendChild(empty('بخش پازل روی این سرور فعال نیست')); }
      if (!r.ok) return fail(r);
      P.tiers = r.body.tiers || []; P.ready = r.body.readiness; P.rows = r.body.puzzles;
      api('/admin/puzzle-topics').then(function (t) { P.topics = t.ok ? t.body.topics : []; api('/admin/puzzle-tags').then(function (g) { P.tags = g.ok ? g.body.tags : []; draw(); }); });
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

VIEWS.clienterrors = function (root) {
  var list = h('div');
  var KIND = { crash: 'کرش', screen: 'صفحه‌ی خراب', manual: 'گزارش دستی' };
  function draw() {
    api('/admin/client-errors').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('گزارش خطای اپ روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      if (!r.body.errors.length) return list.appendChild(empty('خطایی گزارش نشده'));
      r.body.errors.forEach(function (x) {
        var shot = h('div');
        var more = h('div', { style: 'display:none;white-space:pre-wrap;direction:ltr;text-align:left;font-size:12px;color:var(--muted);margin-top:8px' }, [
          h('div', { text: x.context }), h('div', { text: x.detail })]);
        var row = h('div', { class: 'kv', style: 'flex-wrap:wrap;gap:8px' }, [
          badge(KIND[x.kind] || x.kind, x.kind === 'crash' ? 'b-bad' : 'b-warn'),
          h('b', { text: x.screen || '—' }),
          h('span', { text: x.message || '' }),
          h('span', { style: 'color:var(--muted);font-size:12px', text: (x.userName ? x.userName + ' · ' : '') + ago(x.createdAt) + (x.note ? ' · «' + x.note + '»' : '') }),
          h('button', { class: 'btn sm', text: 'جزئیات', onclick: function () { more.style.display = more.style.display === 'none' ? 'block' : 'none'; } }),
          x.hasScreenshot ? h('button', { class: 'btn sm', text: 'عکس صفحه', onclick: function () {
            if (shot.firstChild) return clear(shot);
            api('/admin/client-errors/' + x.id + '/screenshot').then(function (y) {
              if (!y.ok) return fail(y);
              shot.appendChild(h('img', { src: y.body.screenshot, style: 'max-width:320px;max-height:640px;border:2px solid var(--line);border-radius:12px;margin-top:8px' }));
            });
          } }) : null,
          x.resolved ? badge('بررسی شد', 'b-ok') : h('button', { class: 'btn sm', text: 'بررسی شد', onclick: function () { api('/admin/client-errors/' + x.id + '/resolve', { method: 'POST' }).then(function (y) { if (!y.ok) return fail(y); draw(); }); } })]);
        list.appendChild(h('div', {}, [row, more, shot]));
      });
    });
  }
  root.appendChild(card('خطاهای اپ', 'اپ بازیکن وقتی صفحه‌ای خراب شود یا خالی بماند، متن خطا، اطلاعات دستگاه و عکس صفحه را خودش می‌فرستد؛ بازیکن هم می‌تواند دستی گزارش بدهد.', [list]));
  draw();
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
