/** Admin panel views: Words, cities, daily puzzles (browser JS, concatenated into one script by ../views2.ts). */
export const ADMIN_VIEWS2_CONTENT_JS = String.raw`VIEWS.words = function (root) {
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
`;
