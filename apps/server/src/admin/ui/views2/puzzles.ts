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
    var trackFilter = select([['', 'همه‌ی رده‌های سنی'], ['kid', 'کودک'], ['teen', 'نوجوان'], ['adult', 'بزرگسال']], P.track);
    trackFilter.onchange = function () { P.track = trackFilter.value; R.i = 0; draw(); };
    var topicFilter = select([['', 'همه‌ی گروه‌ها'], ['-', 'بدون گروه']].concat(P.topics.map(function (t) { return [t.id, t.nameFa]; })), P.topicF);
    topicFilter.onchange = function () { P.topicF = topicFilter.value; R.i = 0; draw(); };
    var tagFilter = select([['', 'همه‌ی برچسب‌ها']].concat(P.tags.map(function (t) { return [t.slug, t.nameFa]; })), P.tagF);
    tagFilter.onchange = function () { P.tagF = tagFilter.value; R.i = 0; draw(); };
    var tierFilter = select([['', 'همه‌ی لول‌ها'], ['-', 'بدون لول']].concat(P.tiers.map(function (t) { return [t.id, tierLabel(t)]; })), P.tierF);
    tierFilter.onchange = function () { P.tierF = tierFilter.value; R.i = 0; draw(); };
    return [trackFilter, topicFilter, tagFilter, tierFilter];
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
    var cnt = { draft: 0, approved: 0, retired: 0 }, unrev = 0;
    rows.forEach(function (x) { cnt[x.status]++; if (!x.reviewedAt && x.status !== 'retired') unrev++; });
    var tabs = [['draft', 'پیش‌نویس‌ها', cnt.draft], ['approved', 'فعال (قابل بازی)', cnt.approved], ['retired', 'بازنشسته', cnt.retired], ['review', 'بازبینی', unrev], ['new', '＋ ساخت پازل جدید', 0], ['tiers', 'سطح‌بندی', 0], ['topics', 'موضوع‌ها', 0]];
    head.appendChild(h('div', { class: 'tabs' }, tabs.map(function (t) {
      return h('button', { class: 'tab', 'aria-selected': String(P.tab === t[0]), onclick: function () { setTab(t[0]); } }, [t[1], t[2] ? h('span', { class: 'count', text: fa(t[2]) }) : null]);
    })));
    if (r && r.products < r.productsPerPuzzle) head.appendChild(h('div', { class: 'callout warn', text: 'برای ساخت پازل ' + fa(r.productsPerPuzzle) + ' کالا لازم است و فقط ' + fa(r.products) + ' کالا در کاتالوگ هست؛ اول از «کاتالوگ محصولات» کالا اضافه کن.' }));
  }
  /* ---------- card of an existing puzzle: edit everything, then one «ذخیره» ---------- */
  var STATUS_FA = { draft: ['پیش‌نویس', 'b-warn'], approved: ['فعال', 'b-ok'], retired: ['بازنشسته', ''] };
  function prodName(id, fallback) { return P.byId[id] ? P.byId[id].nameFa : fallback || '؟'; }
  function seq(steps) { return steps.reduce(function (pr, st) { return pr.then(function (ok) { return ok ? st() : false; }); }, Promise.resolve(true)); }
  function step(path, method, body) { return function () { return api(path, { method: method, body: body }).then(function (r) { if (!r.ok) { fail(r); return false; } return true; }); }; }
  /* Pop-up that picks the replacement of one product; the choice only lands on the card, «ذخیره» sends it. */
  function openSwapModal(p, D, gi, ii, onPick) {
    var cur = D.items[gi][ii], orig = p.groups[gi].productIds[ii];
    var taken = {}; D.items.forEach(function (g) { g.forEach(function (id) { taken[id] = true; }); });
    var q = h('input', { type: 'search', placeholder: 'جستجوی محصول…' });
    var cats = {}; P.prods.forEach(function (c) { if (c.category) cats[c.category] = true; });
    var catSel = select([['all', 'همه‌ی دسته‌ها']].concat(Object.keys(cats).map(function (c) { return [c, CAT_FA[c] || c]; })), 'all');
    var list = h('div', { class: 'picker-list', style: 'max-height:46vh' });
    var close;
    function drawCands() {
      clear(list);
      var t = q.value.trim(), n = 0;
      P.prods.forEach(function (c) {
        if (n >= 60 || taken[c.id] || TRACK_RANK[c.ageTrack || 'adult'] > TRACK_RANK[p.ageTrack || 'adult'] || (catSel.value !== 'all' && c.category !== catSel.value) || (t && (c.nameFa + ' ' + c.slug).indexOf(t) < 0)) return;
        n++;
        list.appendChild(h('button', { type: 'button', class: 'pick', onclick: function () { onPick(c.id); close(); } }, [c.iconKey ? iconTile(c.iconKey) : null, h('span', { class: 'pn' }, [h('b', { text: c.nameFa }), h('small', { text: (CAT_FA[c.category] || '') + ' · ' + yearsOf(c) })])]));
      });
      if (!n) list.appendChild(empty('محصولی پیدا نشد'));
    }
    q.oninput = drawCands; catSel.onchange = drawCands;
    var body = h('div', { style: 'display:grid;gap:12px' }, [
      h('div', { class: 'swap-now' }, [h('span', { class: 'sub', text: 'محصول فعلی' }), h('b', { text: prodName(cur) }), cur !== orig ? h('button', { class: 'btn sm', text: 'برگرداندن به «' + prodName(orig) + '»', onclick: function () { onPick(orig); close(); } }) : null]),
      h('div', { class: 'toolbar', style: 'margin:0' }, [q, catSel]),
      list
    ]);
    close = modal('جابه‌جایی محصول', body, [{ label: 'بستن' }], {});
    drawCands();
  }
  function puzzleCard(p) {
    var card;
    var sorted = p.groups.map(function (g, i) { return i; }).sort(function (a, b) { return p.groups[a].level - p.groups[b].level; });
    var D = { tier: p.tierId || '', topic: p.topicId || '', tags: (p.tags || []).slice(), items: p.groups.map(function (g) { return g.productIds.slice(); }) };
    var inputs = p.groups.map(function (g) { return h('input', { value: g.titleFa || '', placeholder: 'عنوان این دسته (اجباری)', oninput: refresh }); });
    var tierPick = select(tierOpts(), D.tier); tierPick.onchange = function () { D.tier = tierPick.value; refresh(); };
    var topicPick = select([['', '— بدون گروه —']].concat(P.topics.map(function (t) { return [t.id, t.nameFa]; })), D.topic); topicPick.onchange = function () { D.topic = topicPick.value; refresh(); };
    var chips = h('div', { class: 'toolbar', style: 'margin:0;gap:6px' });
    var saveBtn = h('button', { class: 'btn primary', text: 'ذخیره‌ی تغییرات', onclick: function () { save(); } });
    var dirtyTag = h('span', { class: 'badge b-warn', text: 'تغییر ذخیره‌نشده', hidden: true });
    var groupsBox = h('div', { class: 'pz-groups' });
    function tagsChanged() { var a = (p.tags || []).slice().sort().join(','), b = D.tags.slice().sort().join(','); return a !== b; }
    function itemsChanged() { return D.items.some(function (g, gi) { return g.some(function (id, ii) { return id !== p.groups[gi].productIds[ii]; }); }); }
    function titlesChanged() { return inputs.some(function (inp, i) { return inp.value.trim() !== (p.groups[i].titleFa || ''); }); }
    function isDirty() { return titlesChanged() || D.tier !== (p.tierId || '') || D.topic !== (p.topicId || '') || tagsChanged() || itemsChanged(); }
    function refresh() { var d = isDirty(); saveBtn.disabled = !d; dirtyTag.hidden = !d; card.classList.toggle('dirty', d); }
    function drawChips() {
      clear(chips);
      var defs = P.tags.filter(function (t) { return t.isActive || D.tags.indexOf(t.slug) >= 0; });
      if (!defs.length) return chips.appendChild(h('span', { class: 'sub', text: 'برچسبی تعریف نشده (تب «موضوع‌ها»)' }));
      defs.forEach(function (t) {
        var on = D.tags.indexOf(t.slug) >= 0;
        chips.appendChild(h('button', { type: 'button', class: 'btn sm' + (on ? ' primary' : ''), 'aria-pressed': String(on), text: t.nameFa, onclick: function () {
          D.tags = on ? D.tags.filter(function (x) { return x !== t.slug; }) : D.tags.concat([t.slug]); drawChips(); refresh();
        } }));
      });
    }
    function drawGroups() {
      clear(groupsBox);
      sorted.forEach(function (gi) {
        var g = p.groups[gi], lv = LEVELS[g.level] || LEVELS[0];
        groupsBox.appendChild(h('div', { class: 'pz-group', style: '--lv:' + lv[1] }, [
          h('div', { class: 'pz-lv' }, [h('i'), h('b', { text: lv[2] + ' · ' + lv[0] })]),
          inputs[gi],
          h('div', { class: 'pz-items' }, D.items[gi].map(function (id, ii) {
            var changed = id !== g.productIds[ii], pr = P.byId[id];
            return h('button', { type: 'button', class: 'pz-item' + (changed ? ' changed' : ''), title: changed ? 'عوض شده — اصلی: ' + prodName(g.productIds[ii], g.items[ii]) : 'برای جابه‌جایی با محصول دیگر بزن', onclick: function () {
              openSwapModal(p, D, gi, ii, function (newId) { D.items[gi][ii] = newId; drawGroups(); refresh(); });
            } }, [pr && pr.iconKey ? iconTile(pr.iconKey) : null, h('span', { text: prodName(id, g.items[ii]) }), h('em', { text: '⇄' })]);
          }))
        ]));
      });
    }
    function swapSteps() {
      var pairs = [];
      D.items.forEach(function (g, gi) { g.forEach(function (id, ii) { if (id !== p.groups[gi].productIds[ii]) pairs.push({ from: p.groups[gi].productIds[ii], to: id }); }); });
      if (!pairs.length) return [];
      // A product freed by one swap may be the target of another: try in order, then retry what failed once.
      return [function () {
        var failed = [];
        return pairs.reduce(function (pr, pa) {
          return pr.then(function () { return api('/admin/puzzles/' + p.id + '/swap', { method: 'PUT', body: { fromProductId: pa.from, toProductId: pa.to } }).then(function (r) { if (!r.ok) failed.push(pa); }); });
        }, Promise.resolve()).then(function () {
          return failed.reduce(function (pr, pa) {
            return pr.then(function (ok) { return ok ? api('/admin/puzzles/' + p.id + '/swap', { method: 'PUT', body: { fromProductId: pa.from, toProductId: pa.to } }).then(function (r) {
              if (r.ok) return true;
              var e = r.body && r.body.error;
              toast(e === 'item_track' ? 'یکی از محصول‌ها برای رده‌ی سنی پازل مناسب نیست' : e === 'duplicate_product' ? 'یک محصول نباید دو بار در پازل بیاید' : 'جابه‌جایی انجام نشد', true); return false;
            }) : false; });
          }, Promise.resolve(true));
        });
      }];
    }
    /* One save sends every change of the card: titles, level, group, tags and swapped products. */
    function save(then) {
      var titles = [];
      for (var i = 0; i < p.groups.length; i++) {
        var v = inputs[i].value.trim();
        if (v.length < 2) { toast('عنوان دسته‌ی ' + LEVELS[p.groups[i].level][2] + ' را بنویس', true); inputs[i].focus(); return; }
        titles.push({ level: p.groups[i].level, titleFa: v });
      }
      var steps = [];
      if (titlesChanged()) steps.push(step('/admin/puzzles/' + p.id + '/titles', 'PUT', { titles: titles }));
      if (D.tier !== (p.tierId || '')) steps.push(step('/admin/puzzles/' + p.id + '/tier', 'PUT', { tierId: D.tier || null }));
      if (D.topic !== (p.topicId || '') || tagsChanged()) steps.push(step('/admin/puzzles/' + p.id + '/topic', 'PUT', { topicId: D.topic || null, tags: D.tags }));
      swapSteps().forEach(function (s) { steps.push(s); });
      if (then) steps.push(function () { return Promise.resolve(then()); });
      seq(steps).then(function (ok) { if (ok && !then) toast('تغییرات ذخیره شد'); reload(); });
    }
    function setStatus(st, msg) { return function () { return api('/admin/puzzles/' + p.id, { method: 'PATCH', body: { status: st } }).then(function (r) { if (!r.ok) { fail(r); return false; } toast(msg); return true; }); }; }
    var actions = p.status === 'draft' ? [
      h('button', { class: 'btn ok', text: 'تأیید و انتشار', onclick: function () { save(setStatus('approved', 'پازل تأیید شد و قابل بازی است')); } }),
      h('button', { class: 'btn bad', text: 'دور بریز', onclick: function () { setStatus('retired', 'پازل دور ریخته شد')().then(function () { reload(); }); } })
    ] : p.status === 'approved' ? [
      h('button', { class: 'btn', text: 'برگردان به پیش‌نویس', onclick: function () { setStatus('draft', 'پازل به پیش‌نویس برگشت')().then(function () { reload(); }); } }),
      h('button', { class: 'btn bad', text: 'بازنشسته کن', onclick: function () { setStatus('retired', 'پازل بازنشسته شد')().then(function () { reload(); }); } })
    ] : [h('button', { class: 'btn ok', text: 'دوباره فعال کن', onclick: function () { setStatus('approved', 'پازل دوباره فعال شد')().then(function () { reload(); }); } })];
    var st = STATUS_FA[p.status] || ['', ''];
    /* Review mark: saves the card's pending edits first, then stamps «reviewed now»; the puzzle's status and serving stay as they are. */
    function reviewStep() { return api('/admin/puzzles/' + p.id + '/review', { method: 'PUT', body: { reviewed: true } }).then(function (r) { if (!r.ok) { fail(r); return false; } toast('بازبینی ثبت شد'); return true; }); }
    function clearReview() { api('/admin/puzzles/' + p.id + '/review', { method: 'PUT', body: { reviewed: false } }).then(function (r) { if (!r.ok) return fail(r); toast('علامت بازبینی برداشته شد'); reload(); }); }
    var reviewStrip = h('div', { class: 'pz-review' + (p.reviewedAt ? ' done' : '') }, [
      p.reviewedAt ? badge('بازبینی شد · ' + when(p.reviewedAt), 'b-ok') : badge('بازبینی نشده', 'b-warn'),
      h('span', { style: 'flex:1' }),
      p.reviewedAt ? h('button', { class: 'btn sm', text: 'برداشتن علامت', onclick: clearReview }) : null,
      h('button', { class: 'btn sm' + (p.reviewedAt ? '' : ' ok'), text: p.reviewedAt ? 'بازبینی مجدد' : 'بازبینی شد ✓', onclick: function () { save(reviewStep); } })
    ]);
    card = h('div', { class: 'card pz pz-' + p.status }, [
      h('div', { class: 'pz-head' }, [badge(st[0], st[1]), badge(p.source === 'generated' ? 'ساخته‌ی خودکار' : 'دستی', 'b-info'), p.ageTrack && p.ageTrack !== 'adult' ? badge(p.ageTrack === 'kid' ? 'کودک' : 'نوجوان', 'b-warn') : null, h('span', { class: 'sub', text: ago(p.createdAt) }), dirtyTag]),
      reviewStrip,
      h('div', { class: 'pz-meta' }, [field('لول (سطح)', tierPick), field('گروه (موضوع)', topicPick), h('div', { class: 'f' }, ['برچسب‌ها', chips])]),
      groupsBox,
      h('div', { class: 'actions pz-foot' }, [saveBtn].concat(actions))
    ]);
    drawChips(); drawGroups(); refresh();
    card.reviewNow = function () { save(reviewStep); };
    return card;
  }
  /* ---------- AI review assistant: looks at the filtered puzzles, edits what needs it, sends those back to draft ---------- */
  var REVIEW_MAX = 10;
  function openAssistant(rows) {
    var targets = rows.slice(0, REVIEW_MAX), busy = false;
    var provider = select([['', 'در حال بارگذاری…']], ''), model = h('input', { type: 'text', placeholder: 'خالی = مدل پیش‌فرض سرویس', style: 'direction:ltr' });
    var extra = h('textarea', { rows: 4, maxlength: 1000, placeholder: 'دستور اضافه برای همین اجرا (اختیاری). مثلاً: «عنوان‌ها کوتاه‌تر و شوخ‌تر باشند»، «محصول‌های مبهم را عوض کن»، «به دهه‌ی ۶۰ حساس باش»' });
    var dry = h('input', { type: 'checkbox' });
    var out = h('div', { class: 'rv-out' });
    var note = h('div', { class: 'callout', text: rows.length > REVIEW_MAX ? 'روی ' + fa(rows.length) + ' پازلِ فیلتر شده فقط ' + fa(REVIEW_MAX) + ' تای اول بررسی می‌شود؛ فیلتر را تنگ‌تر کن یا چند بار اجرا کن.' : 'دستیار ' + fa(rows.length) + ' پازلِ فیلتر شده را یکی‌یکی می‌خواند. اگر پازلی ایراد داشته باشد عنوان یا محصولش را اصلاح می‌کند و آن را به «پیش‌نویس» می‌برد تا خودت دوباره تأیید کنی.' });
    api('/admin/ai').then(function (r) {
      var ps = r.ok ? (r.body.providers || []) : [];
      clear(provider);
      if (!ps.length) { provider.appendChild(h('option', { value: '', text: 'هیچ سرویسی تنظیم نشده' })); return; }
      ps.forEach(function (x) { provider.appendChild(h('option', { value: x.id, text: x.label })); });
    });
    var RES = { ok: ['سالم بود؛ دست نخورد', 'b-ok'], edited: ['ویرایش شد و پیش‌نویس شد', 'b-warn'], would_edit: ['نیاز به ویرایش دارد (فقط گزارش)', 'b-info'], error: ['خطا', 'b-bad'] };
    function name(id) { var r = P.rows.filter(function (x) { return x.id === id; })[0]; return r ? r.groups.slice().sort(function (a, b) { return a.level - b.level; }).map(function (g) { return g.titleFa || '—'; }).join(' · ') : id; }
    function show(body) {
      clear(out);
      (body.outcomes || []).forEach(function (o) {
        var rs = RES[o.result] || ['', ''];
        var det = [];
        if (o.reason) det.push(h('div', { class: 'sub', text: o.reason }));
        (o.titles || []).forEach(function (t) { det.push(h('div', { class: 'sub', text: '✎ عنوان دسته‌ی ' + LEVELS[t.level][2] + ': «' + t.titleFa + '»' })); });
        (o.swaps || []).forEach(function (s) { det.push(h('div', { class: 'sub', text: '⇄ ' + s.fromName + ' ← ' + s.toName + (s.reason ? ' (' + s.reason + ')' : '') })); });
        if (o.result === 'error') det.push(h('div', { class: 'sub', text: AI_ERR[o.error] || o.error }));
        out.appendChild(h('div', { class: 'rv-row' }, [h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [badge(rs[0], rs[1]), h('b', { text: name(o.puzzleId) })])].concat(det)));
      });
    }
    var close = modal('دستیار بازبینی پازل‌ها', h('div', { style: 'display:grid;gap:12px' }, [
      note,
      h('div', { class: 'form-grid' }, [field('سرویس هوش مصنوعی', provider), field('مدل', model)]),
      field('دستور اضافه (به پرامپت همین اجرا اضافه می‌شود)', extra),
      h('label', { class: 'sub' }, [dry, ' فقط گزارش بده، چیزی را تغییر نده']),
      out
    ]), [{ label: 'بستن', run: function () { if (anyEdited) reload(); } }, { label: 'شروع بازبینی', cls: 'primary', keepOpen: true, run: function () {
      if (busy) return; if (!provider.value) return toast('سرویس هوش مصنوعی انتخاب نشده', true); if (!targets.length) return toast('پازلی در فیلتر نیست', true);
      busy = true; clear(out); out.appendChild(h('div', { class: 'sub', text: 'در حال بازبینی… (برای هر پازل چند ثانیه)' }));
      api('/admin/ai/puzzle-review', { method: 'POST', body: { provider: provider.value, model: model.value.trim() || undefined, puzzleIds: targets.map(function (x) { return x.id; }), extra: extra.value.trim(), dryRun: dry.checked } }).then(function (r) {
        busy = false; clear(out);
        if (!r.ok) return out.appendChild(h('div', { class: 'callout warn', text: aiErrorText(r.body, 'بازبینی انجام نشد') }));
        anyEdited = anyEdited || r.body.outcomes.some(function (o) { return o.result === 'edited'; });
        show(r.body);
      });
    } }], {});
    var anyEdited = false;
  }
  function drawList() {
    var rows = P.rows.filter(function (x) { return x.status === P.tab && matches(x) && revOk(x, P.revF); });
    var box = h('div');
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
