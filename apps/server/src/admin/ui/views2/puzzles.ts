/** Admin panel views: Puzzles, user reports, suggestions (UGC) (browser JS, concatenated into one script by ../views2.ts). */
export const ADMIN_VIEWS2_PUZZLES_JS = String.raw`VIEWS.puzzles = function (root) {
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
