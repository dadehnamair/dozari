/** Admin panel views: Invites, badges, taunts, chat reports, tournaments (browser JS, concatenated into one script by ../views2.ts). */
export const ADMIN_VIEWS2_COMMUNITY_JS = String.raw`VIEWS.invites = function (root) {
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
  var TRACKS = [['adult', 'بزرگسال'], ['teen', 'نوجوان'], ['kid', 'کودک']];
  function trackSel(cur) {
    var sel = h('select', {}, TRACKS.map(function (t) { return h('option', { value: t[0], text: 'کتابخانه‌ی ' + t[1] }); }));
    sel.value = cur || 'adult';
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
        var who = trackSel(c.ageTrack);
        who.onchange = function () { api('/admin/taunt-categories/' + c.id, { method: 'PATCH', body: { ageTrack: who.value } }).then(function (x) { if (!x.ok) return fail(x); toast('ذخیره شد'); }); };
        list.appendChild(h('div', { class: 'card', style: 'padding:12px' }, [
          h('div', { style: 'display:flex;gap:8px;align-items:center' }, [name, who, where, c.isActive ? null : badge('پنهان', 'b-warn'),
            h('button', { class: 'btn sm', text: 'تغییر نام', onclick: function () { api('/admin/taunt-categories/' + c.id, { method: 'PATCH', body: { nameFa: name.value.trim() } }).then(function (x) { if (!x.ok) return fail(x); toast('ذخیره شد'); draw(); }); } }),
            h('button', { class: 'btn sm', text: c.isActive ? 'پنهان‌کردن دسته' : 'نمایش دسته', onclick: function () { api('/admin/taunt-categories/' + c.id, { method: 'PATCH', body: { isActive: !c.isActive } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })]),
          body]));
      });
    });
  }
  var cat = h('input', { type: 'text', placeholder: 'نام دسته‌ی تازه', maxlength: 40 });
  var newWhere = citySel(''), newTrack = trackSel('adult');
  root.appendChild(card('کل‌کل‌های آماده', 'بازیکن‌ها در چت و در دوئل فقط از این فهرست کل‌کل می‌فرستند (بدون نیاز به کد معرف). لحن را شوخ نگه دار و توهین نکن. دسته‌ی مخصوص یک شهر (لهجه و اصطلاح محلی) فقط به بازیکن‌های همان شهر نشان داده می‌شود. هر رده‌ی سنی کتابخانه‌ی خودش را دارد: کودک و نوجوان فقط دسته‌های رده‌ی خودشان را می‌بینند.', [list]));
  root.appendChild(card('دسته‌ی تازه', null, [h('div', { class: 'toolbar' }, [cat, newTrack, newWhere, h('button', { class: 'btn primary', text: 'افزودن', onclick: function () { api('/admin/taunt-categories', { method: 'POST', body: { nameFa: cat.value.trim(), cityId: newWhere.value || null, ageTrack: newTrack.value } }).then(function (x) { if (!x.ok) return fail(x); cat.value = ''; draw(); }); } })])]));
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
  var sponsorNames = {};
  var sponsorSel = document.createElement('select');
  sponsorSel.appendChild(h('option', { value: '', text: 'بدون اسپانسر' }));
  function loadSponsors() {
    api('/admin/sponsors').then(function (r) {
      if (!r.ok) return;
      r.body.sponsors.forEach(function (sp) {
        sponsorNames[sp.id] = sp.nameFa;
        if (sp.isActive) sponsorSel.appendChild(h('option', { value: sp.id, text: sp.nameFa }));
      });
      draw();
    });
  }
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
          h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [h('b', { text: t.titleFa }), badge(st[0], st[1]), t.sponsorId && sponsorNames[t.sponsorId] ? badge('اسپانسر: ' + sponsorNames[t.sponsorId], 'b-mute') : null, h('span', { class: 'h', text: fa(t.joined) + ' از ' + fa(t.size) + ' نفر · ورودی ' + faNum(t.entryCoins) + ' سکه' + (t.entryGems ? ' + ' + faNum(t.entryGems) + ' الماس' : '') + ' · از لول ' + fa(t.minLevel) + ' · شروع ' + when(t.startsAt) })]),
          h('div', { class: 'h', style: 'margin-top:4px', text: prizes || 'بدون جایزه' }),
          h('div', { class: 'toolbar', style: 'margin-top:8px' }, [
            t.status === 'draft' || t.status === 'open' ? h('button', { class: 'btn', text: 'ویرایش', onclick: function () { openForm(t); } }) : null,
            t.status === 'draft' ? h('button', { class: 'btn primary', text: 'منتشر کن (باز کردن ثبت‌نام)', onclick: act('publish') }) : null,
            t.status === 'open' ? h('button', { class: 'btn primary', text: 'همین حالا شروع کن', onclick: act('start', 'ثبت‌نام بسته و تورنومنت شروع شود؟ اگر به حد نصاب نرسیده باشد لغو و ورودی‌ها برگردانده می‌شود.') }) : null,
            t.status === 'draft' || t.status === 'open' || t.status === 'running' ? h('button', { class: 'btn bad', text: 'لغو و بازپرداخت', onclick: act('cancel', 'تورنومنت لغو شود و ورودی همه برگردانده شود؟') }) : null
          ])
        ]));
      });
    });
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function localInput(ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function num(v, min) { return h('input', { type: 'number', value: v, min: min === undefined ? 0 : min, style: 'width:100px' }); }
  /* One form for both: openForm() creates, openForm(t) edits a draft / open tournament (structural fields lock once someone joined). */
  function openForm(t) {
    var prize = function (place, key) { var p = t && t.prizes.filter(function (x) { return x.place === place; })[0]; return p ? p[key] : 0; };
    var title = h('input', { type: 'text', placeholder: 'نام تورنومنت', maxlength: 80, value: t ? t.titleFa : '' });
    var desc = h('textarea', { placeholder: 'توضیحات برای صفحه‌ی اختصاصی تورنومنت (قانون‌ها، جایزه‌ها، داستان)…', maxlength: 4000, style: 'min-height:90px' }); desc.value = t ? (t.descriptionFa || '') : '';
    var size = select([['4', '۴ نفر'], ['8', '۸ نفر'], ['16', '۱۶ نفر'], ['32', '۳۲ نفر']], t ? String(t.size) : '16');
    var minPlayers = num(t ? t.minPlayers : 4, 2), fee = num(t ? t.entryCoins : 20), gemFee = num(t ? t.entryGems || 0 : 0), level = num(t ? t.minLevel : 1, 1);
    var p1 = num(prize(1, 'coins') || (t ? 0 : 100)), p2 = num(prize(2, 'coins') || (t ? 0 : 40)), p3 = num(prize(3, 'coins') || (t ? 0 : 10));
    var s1 = num(prize(1, 'spins')), s2 = num(prize(2, 'spins')), s3 = num(prize(3, 'spins')), g1 = num(prize(1, 'gems')), g2 = num(prize(2, 'gems')), g3 = num(prize(3, 'gems'));
    var startsAt = h('input', { type: 'datetime-local', value: t ? localInput(t.startsAt) : '' });
    var sponsor = document.createElement('select');
    Array.prototype.forEach.call(sponsorSel.options, function (o) { sponsor.appendChild(h('option', { value: o.value, text: o.text })); });
    if (t && t.sponsorId && !Array.prototype.some.call(sponsor.options, function (o) { return o.value === t.sponsorId; })) sponsor.appendChild(h('option', { value: t.sponsorId, text: sponsorNames[t.sponsorId] || 'اسپانسر فعلی' }));
    sponsor.value = t && t.sponsorId ? t.sponsorId : '';
    var publish = h('input', { type: 'checkbox' }), botFill = h('input', { type: 'checkbox' }), concurrent = h('input', { type: 'checkbox' });
    botFill.checked = !!(t && t.botFill); concurrent.checked = !!(t && t.allowConcurrent);
    var note = h('div', { class: 'h' });
    function recalc() { var pool = +fee.value * +size.value, prizes = (+p1.value) + (+p2.value) + 2 * (+p3.value); note.textContent = 'جمع ورودی اگر پر شود: ' + faNum(pool) + ' سکه · جمع جایزه‌ها: ' + faNum(prizes) + ' سکه' + (prizes > pool ? ' ← جایزه از ورودی بیشتر است؛ این تفاوت سکه‌ی تازه به اقتصاد اضافه می‌کند.' : ''); }
    [fee, size, p1, p2, p3].forEach(function (el) { el.addEventListener('input', recalc); }); recalc();
    var flags = [h('label', {}, [botFill, ' جای خالی با ربات پر شود']), h('label', {}, [concurrent, ' کسی که در تورنومنت دیگری هست هم بتواند وارد شود'])];
    if (!t) flags.push(h('label', {}, [publish, ' همین حالا منتشر شود']));
    formModal(t ? 'ویرایش تورنومنت' : 'تورنومنت تازه', [
      ['نام', title], ['توضیحات', desc],
      h('div', { class: 'toolbar' }, [field('ظرفیت', size), field('حداقل نفرات برای برگزاری', minPlayers), field('ورودی (سکه، ۰ = رایگان)', fee), field('ورودی الماس (۰ = بدون الماس)', gemFee), field('کمترین لول (۱ = همه)', level), field('شروع و بسته‌شدن ثبت‌نام', startsAt), field('اسپانسر', sponsor)]),
      h('div', { class: 'toolbar' }, [field('جایزه‌ی مقام اول', p1), field('مقام دوم', p2), field('مقام سوم (به هر نفر)', p3)]),
      h('div', { class: 'toolbar' }, [field('الماس مقام اول', g1), field('مقام دوم', g2), field('مقام سوم (به هر نفر)', g3)]),
      h('div', { class: 'toolbar' }, [field('چرخش گردونه‌ی مقام اول', s1), field('مقام دوم', s2), field('مقام سوم (به هر نفر)', s3)]),
      note, h('div', { class: 'toolbar' }, flags)
    ], function () {
      if (!startsAt.value) { toast('زمان شروع را بگذار', true); return false; }
      var prizes = [{ place: 1, coins: +p1.value, gems: +g1.value, spins: +s1.value }, { place: 2, coins: +p2.value, gems: +g2.value, spins: +s2.value }, { place: 3, coins: +p3.value, gems: +g3.value, spins: +s3.value }].filter(function (p) { return p.coins > 0 || p.gems > 0 || p.spins > 0; });
      var body = { titleFa: title.value.trim(), descriptionFa: desc.value.trim(), iconKey: 'trophy', size: +size.value, minPlayers: +minPlayers.value, entryCoins: +fee.value, entryGems: +gemFee.value, minLevel: +level.value, startsAt: new Date(startsAt.value).getTime(), botFill: botFill.checked, allowConcurrent: concurrent.checked, sponsorId: sponsor.value || null, prizes: prizes };
      if (!t) body.publish = publish.checked;
      return api(t ? '/admin/tournaments/' + t.id : '/admin/tournaments', { method: t ? 'PATCH' : 'POST', body: body }).then(function (x) {
        if (x.status === 409) { toast('کسی ثبت‌نام کرده؛ ظرفیت، ورودی، لول و حداقل نفرات دیگر قابل تغییر نیست', true); return false; }
        if (!x.ok) { fail(x); return false; }
        toast(t ? 'تغییرات ذخیره شد' : 'تورنومنت ساخته شد'); draw(); return true;
      });
    });
  }
  root.appendChild(card('تورنومنت‌ها', 'جدول حذفی تک‌حذفی؛ هر دور با یک دوئل. بازیکنی که نرسد یا ببازد حذف می‌شود، تساوی دوباره بازی می‌شود.', [list]));
  root.appendChild(h('section', { class: 'card add-card' }, [h('div', { class: 'add-head' }, [h('div', {}, [h('h2', { text: 'تورنومنت تازه' }), h('div', { class: 'sub', text: 'مقام سوم به هر دو بازنده‌ی نیمه‌نهایی داده می‌شود. اگر تعداد ثبت‌نام‌ها کمتر از ظرفیت باشد، جدول با «بای» پر می‌شود (به شرط رسیدن به حداقل نفرات).' })]), h('button', { class: 'btn primary', text: '＋ تورنومنت تازه', onclick: function () { openForm(); } })])]));
  draw();
  loadSponsors();
};
VIEWS.sponsors = function (root) {
  var list = h('div');
  function draw() {
    api('/admin/sponsors').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('اسپانسر روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      if (!r.body.sponsors.length) return list.appendChild(empty('هنوز اسپانسری تعریف نکرده‌ای'));
      r.body.sponsors.forEach(function (sp) {
        var toggle = h('button', { class: 'btn sm', text: sp.isActive ? 'غیرفعال کن' : 'فعال کن', onclick: function () { api('/admin/sponsors/' + sp.id, { method: 'PATCH', body: { isActive: !sp.isActive } }).then(function (x) { if (!x.ok) return fail(x); toast('انجام شد'); draw(); }); } });
        var edit = h('button', { class: 'btn sm', text: 'ویرایش', onclick: function () {
          var name = prompt('نام اسپانسر', sp.nameFa); if (name === null) return;
          var tagline = prompt('شعار کوتاه', sp.taglineFa); if (tagline === null) return;
          var desc = prompt('معرفی', sp.descriptionFa); if (desc === null) return;
          var banner = prompt('لینک https بنر (خالی = بدون بنر)', sp.bannerUrl || ''); if (banner === null) return;
          var logo = prompt('لینک https لوگو (خالی = بدون لوگو)', sp.logoUrl || ''); if (logo === null) return;
          var link = prompt('لینک https سایت اسپانسر (خالی = بدون لینک)', sp.linkUrl || ''); if (link === null) return;
          var accent = prompt('رنگ کارت مثل #FFAA7A (خالی = پیش‌فرض)', sp.accent || ''); if (accent === null) return;
          api('/admin/sponsors/' + sp.id, { method: 'PATCH', body: { nameFa: name, taglineFa: tagline, descriptionFa: desc, bannerUrl: banner.trim() || null, logoUrl: logo.trim() || null, linkUrl: link.trim() || null, accent: accent.trim() || null } }).then(function (x) { if (!x.ok) return fail(x); toast('ذخیره شد'); draw(); });
        } });
        list.appendChild(h('div', { class: 'card', style: 'padding:12px' }, [
          h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
            sp.logoUrl ? h('img', { src: sp.logoUrl, style: 'width:36px;height:36px;border-radius:8px;object-fit:cover', alt: '' }) : null,
            h('b', { text: sp.nameFa }), badge(sp.isActive ? 'فعال' : 'غیرفعال', sp.isActive ? 'b-ok' : 'b-mute'), h('span', { class: 'h', text: sp.taglineFa })]),
          sp.bannerUrl ? h('img', { src: sp.bannerUrl, style: 'margin-top:8px;max-width:100%;max-height:120px;border-radius:10px', alt: '' }) : null,
          h('div', { class: 'toolbar', style: 'margin-top:8px' }, [edit, toggle])
        ]));
      });
    });
  }
  var name = h('input', { type: 'text', placeholder: 'نام اسپانسر', maxlength: 60 });
  var tagline = h('input', { type: 'text', placeholder: 'شعار کوتاه (زیر نام نشان داده می‌شود)', maxlength: 120 });
  var desc = h('textarea', { placeholder: 'معرفی اسپانسر برای صفحه‌ی تورنومنت…', maxlength: 1000, style: 'min-height:80px' });
  var banner = h('input', { type: 'text', placeholder: 'https://… لینک بنر (پیشنهاد: ۱۰۰۰×۴۰۰)', maxlength: 300 });
  var logo = h('input', { type: 'text', placeholder: 'https://… لینک لوگوی مربع', maxlength: 300 });
  var link = h('input', { type: 'text', placeholder: 'https://… سایت یا صفحه‌ی اسپانسر', maxlength: 300 });
  var accent = h('input', { type: 'text', placeholder: '#FFAA7A', maxlength: 7, style: 'width:100px' });
  root.appendChild(card('اسپانسرها', 'اسپانسر را یک بار تعریف کن و در ساخت تورنومنت انتخابش کن. اسپانسر غیرفعال‌شده دیگر نشان داده نمی‌شود. تصویرها باید روی سرور خودمان (لینک https) باشند.', [list]));
  root.appendChild(addCard('اسپانسر تازه', 'بنر بالای صفحه‌ی تورنومنت و لوگو کنار نام او در فهرست نشان داده می‌شود.', 'اسپانسر تازه', [
    ['نام', name], ['شعار', tagline], ['معرفی', desc], ['لینک بنر', banner], ['لینک لوگو', logo], ['لینک سایت', link], ['رنگ کارت', accent]
  ], function () {
    return api('/admin/sponsors', { method: 'POST', body: { nameFa: name.value.trim(), taglineFa: tagline.value.trim(), descriptionFa: desc.value.trim(), bannerUrl: banner.value.trim() || null, logoUrl: logo.value.trim() || null, linkUrl: link.value.trim() || null, accent: accent.value.trim() || null } }).then(function (x) {
      if (!x.ok) { fail(x); return false; }
      toast('اسپانسر ساخته شد'); [name, tagline, desc, banner, logo, link, accent].forEach(function (el) { el.value = ''; }); draw(); return true;
    });
  }));
  draw();
};
`;
