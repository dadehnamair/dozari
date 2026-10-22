/** Admin panel views: installs per market / PWA, gameplay and per-player puzzle stats, Bazaar release status (browser JS, concatenated by ../views2.ts). */
export const ADMIN_VIEWS2_STATS_JS = String.raw`
var CHANNEL_FA = { bazaar: 'کافه‌بازار', myket: 'مایکت', bale: 'بله (مینی‌اپ/بیلد)', direct_android: 'اندروید مستقیم (APK / بدون مارکت)', ios: 'آی‌اواس', pwa: 'PWA (نصب‌شده روی صفحه‌ی اصلی)', web: 'وب (تب مرورگر)' };
var MODE_FA = { solo: 'تکی', daily: 'پازل روز', duel: 'دوئل ۱ به ۱', team: 'تیمی ۲ به ۲' };
function barRow(label, value, max, detail) {
  var pct = max ? Math.round((value / max) * 100) : 0;
  return h('div', { class: 'kv' }, [h('span', { style: 'min-width:150px', text: label }), h('span', { style: 'flex:1;margin:0 14px' }, [h('div', { class: 'bar', style: 'margin:0' }, [h('i', { style: 'width:' + Math.max(value ? 2 : 0, pct) + '%' })])]), h('span', {}, [h('b', { class: 'num', text: faNum(value) }), detail ? h('span', { class: 'muted', style: 'font-size:12.5px', text: ' ' + detail }) : null])]);
}
function simpleTable(head, rows) {
  return h('div', { class: 'tbl-wrap' }, [h('table', {}, [h('thead', {}, [h('tr', {}, head.map(function (x) { return h('th', { text: x }); }))]), h('tbody', {}, rows.map(function (r) { return h('tr', {}, r.map(function (c) { return h('td', {}, [c === null || c === undefined ? '' : (typeof c === 'object' ? c : String(c))]); })); }))])]);
}
function daysPicker(current, onPick) {
  var sel = h('select', { 'aria-label': 'بازه' }, [[7, '۷ روز اخیر'], [30, '۳۰ روز اخیر'], [90, '۹۰ روز اخیر'], [365, 'یک سال اخیر']].map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
  sel.value = String(current);
  sel.onchange = function () { onPick(Number(sel.value)); };
  return sel;
}

VIEWS.installs = function (root) {
  root.appendChild(pageHead('نصب‌ها و بازارها', 'هر حساب از کدام مارکت (یا PWA و وب) اولین بار دیده شده؛ بر اساس گزارش خود اپ'));
  var wrap = h('div'); root.appendChild(wrap);
  Promise.all([api('/admin/stats/installs'), api('/admin/stats/bazaar')]).then(function (rs) {
    var r = rs[0], bz = rs[1];
    if (r.status === 404) return wrap.appendChild(banner('info', 'آمار فقط وقتی دیتابیس وصل باشد نمایش داده می‌شود.'));
    if (!r.ok) return fail(r);
    var d = r.body, chans = d.channels.filter(function (c) { return c.total > 0; }).sort(function (a, b) { return b.total - a.total; });
    var known = d.total - d.unknown;
    var by = {}; d.channels.forEach(function (c) { by[c.channel] = c; });
    var mk = function (key) { return by[key] ? by[key].total : 0; };
    wrap.appendChild(h('div', { class: 'grid kpis' }, [
      statCard('کل حساب‌ها', faNum(d.total), fa(known) + ' با اطلاعات دستگاه · ' + fa(d.unknown) + ' بدون', '#4f46e5'),
      statCard('کافه‌بازار', faNum(mk('bazaar')), fa(by.bazaar ? by.bazaar.new7d : 0) + ' جدید در ۷ روز', '#22a45d'),
      statCard('مایکت', faNum(mk('myket')), fa(by.myket ? by.myket.new7d : 0) + ' جدید در ۷ روز', '#ef6c3d'),
      statCard('PWA', faNum(mk('pwa')), fa(by.pwa ? by.pwa.new7d : 0) + ' جدید در ۷ روز', '#14b8a6'),
      statCard('وب (مرورگر)', faNum(mk('web')), fa(by.web ? by.web.new7d : 0) + ' جدید در ۷ روز', '#f5b73b')
    ]));
    wrap.appendChild(h('div', { style: 'height:16px' }));

    var max = chans.reduce(function (m, c) { return Math.max(m, c.total); }, 0);
    wrap.appendChild(h('section', { class: 'card' }, [h('h2', { text: 'سهم هر کانال' }), h('div', { class: 'sub', text: 'مجموع حساب‌ها به تفکیک مرجع اولین نصب' })].concat(
      chans.length ? chans.map(function (c) { return barRow(CHANNEL_FA[c.channel] || c.channel, c.total, max, known ? fa(Math.round((c.total / known) * 100)) + '٪' : ''); }) : [empty('هنوز دستگاهی گزارش نشده')])));
    wrap.appendChild(h('div', { style: 'height:16px' }));

    wrap.appendChild(h('section', { class: 'card flush' }, [h('div', { class: 'card-h' }, [h('h2', { text: 'جزئیات هر کانال' })]),
      simpleTable(['کانال', 'کل', 'جدید ۲۴س', 'جدید ۷ روز', 'جدید ۳۰ روز', 'فعال ۲۴س', 'فعال ۷ روز'], d.channels.map(function (c) {
        return [CHANNEL_FA[c.channel] || c.channel, faNum(c.total), faNum(c.new1d), faNum(c.new7d), faNum(c.new30d), faNum(c.active1d), faNum(c.active7d)];
      }))]));
    if (d.switched) wrap.appendChild(banner('info', fa(d.switched) + ' حساب اندرویدی الان با بیلد مارکتی غیر از مارکت اولشان بازی می‌کنند.'));

    wrap.appendChild(h('div', { style: 'height:16px' }));
    var builds = d.builds.slice(0, 40);
    wrap.appendChild(h('section', { class: 'card flush' }, [h('div', { class: 'card-h' }, [h('h2', { text: 'نسخه‌ی اپ (build) در هر کانال' })]),
      builds.length ? simpleTable(['کانال', 'build', 'حساب'], builds.map(function (b) { return [CHANNEL_FA[b.channel] || b.channel, b.build ? fa(b.build) : 'نامشخص', faNum(b.count)]; })) : empty('داده‌ای نیست')]));

    // New accounts per day, last 30 days, stacked as plain bars of the total with the split in the tooltip text.
    var days = {}; d.daily.forEach(function (x) { days[x.day] = days[x.day] || { total: 0, parts: [] }; days[x.day].total += x.count; days[x.day].parts.push((CHANNEL_FA[x.channel] || x.channel).split(' ')[0] + ' ' + fa(x.count)); });
    var keys = Object.keys(days).sort(), dmax = keys.reduce(function (m, k) { return Math.max(m, days[k].total); }, 0);
    wrap.appendChild(h('div', { style: 'height:16px' }));
    wrap.appendChild(h('section', { class: 'card' }, [h('h2', { text: 'حساب‌های تازه در ۳۰ روز اخیر' }), h('div', { class: 'sub', text: 'روز به وقت تهران؛ جلوی هر روز سهم کانال‌ها' })].concat(
      keys.length ? keys.map(function (k) { return barRow(fa(k), days[k].total, dmax, days[k].parts.join(' · ')); }) : [empty('حساب تازه‌ای نیست')])));

    // CafeBazaar release status (Pishkhan API); install counts are not part of that API, only the release state.
    wrap.appendChild(h('div', { style: 'height:16px' }));
    var card = h('section', { class: 'card' }, [h('h2', { text: 'وضعیت انتشار در کافه‌بازار' }), h('div', { class: 'sub', text: 'از API پیشخان بازار (فقط خواندن)؛ آمار نصب خود بازار در پیشخان دیده می‌شود' })]);
    wrap.appendChild(card);
    if (!bz.ok) card.appendChild(empty('وضعیت بازار خوانده نشد'));
    else if (!bz.body.configured) card.appendChild(banner('info', 'توکن پیشخان تنظیم نشده. متغیر BAZAAR_PISHKHAN_TOKEN را روی سرور بگذار (پیشخان بازار ← برنامه ← API پیشخان بازار ← دریافت توکن جدید).'));
    else {
      var slots = [['آخرین انتشار', bz.body.published], ['آخرین کامیت (در انتظار بررسی/انتشار)', bz.body.committed], ['رهانش کامیت‌نشده (پیش‌نویس)', bz.body.uncommitted]];
      slots.forEach(function (s) {
        var slot = s[1], rel = slot && slot.release;
        card.appendChild(sectionTitle(s[0]));
        if (slot && slot.error) return card.appendChild(banner('bad', slot.error));
        if (!rel) return card.appendChild(h('div', { class: 'muted', style: 'padding:4px 0 10px', text: 'چیزی ثبت نشده' }));
        var pk = rel.packages[0] || {};
        card.appendChild(defs([
          ['نسخه', h('span', { class: 'ltr', text: (pk.versionName || '؟') + ' (' + (pk.versionCode === null || pk.versionCode === undefined ? '؟' : pk.versionCode) + ')' })],
          ['حجم', pk.apkSize ? fa(Math.round(pk.apkSize / 1024 / 1024 * 10) / 10) + ' مگابایت' : 'نامشخص'],
          ['تاریخ ساخت رهانش', rel.creationDate ? h('span', { class: 'ltr', text: rel.creationDate.slice(0, 16).replace('T', ' ') }) : 'نامشخص'],
          ['درصد انتشار تدریجی', rel.stagedRolloutPercentage === null ? 'نامشخص' : fa(rel.stagedRolloutPercentage) + '٪'],
          ['انتشار خودکار', rel.autoPublish === null ? 'نامشخص' : (rel.autoPublish ? 'بله' : 'خیر')],
          ['توضیحات نسخه', rel.changelogFa || rel.changelogEn || 'ندارد']
        ]));
      });
      card.appendChild(h('div', { class: 'muted', style: 'font-size:12.5px', text: 'آخرین بررسی ' + ago(bz.body.checkedAt) + ' (هر چند دقیقه یک بار تازه می‌شود)' }));
    }
  });
};

VIEWS.gameplay = function (root) {
  var days = 30;
  root.appendChild(pageHead('بازی و پازل‌ها', 'چند پازل بازی شده، چند گروه پیدا شده و چقدر اشتباه و راهنما بوده'));
  var bar = h('div', { class: 'toolbar' }), wrap = h('div'); root.appendChild(bar); root.appendChild(wrap);
  function draw() {
    clear(bar); bar.appendChild(daysPicker(days, function (n) { days = n; draw(); }));
    clear(wrap);
    api('/admin/stats/gameplay?days=' + days).then(function (r) {
      if (r.status === 404) return wrap.appendChild(banner('info', 'آمار فقط وقتی دیتابیس وصل باشد نمایش داده می‌شود.'));
      if (!r.ok) return fail(r);
      var g = r.body, done = g.wins + g.losses + g.draws;
      wrap.appendChild(banner('info', 'ثبت تک‌تک پازل‌ها از نسخه‌ای شروع شده که این صفحه را آورده؛ بازی‌های قبل از آن در این جدول نیستند (جمع قدیمی بازی/برد/باخت هر بازیکن در پروفایلش هست).'));
      wrap.appendChild(h('div', { class: 'grid kpis' }, [
        statCard('پازل بازی‌شده', faNum(g.plays), fa(g.players) + ' بازیکن', '#4f46e5'),
        statCard('پازل مصرف‌شده (متفاوت)', faNum(g.puzzlesUsed), 'از ' + fa(g.puzzlesTotal) + ' پازل · ' + fa(g.puzzlesUnplayed) + ' دست‌نخورده', '#ef6c3d', null, g.puzzlesTotal ? (g.puzzlesUsed / g.puzzlesTotal) * 100 : 0),
        statCard('گروه پیداشده', faNum(g.groupsSolved), g.plays ? 'میانگین ' + fa(Math.round((g.groupsSolved / g.plays) * 10) / 10) + ' از ۴ در هر پازل' : '', '#22a45d'),
        statCard('جواب غلط', faNum(g.mistakes), g.plays ? 'میانگین ' + fa(Math.round((g.mistakes / g.plays) * 10) / 10) + ' در هر پازل' : '', '#ef4444'),
        statCard('راهنمای مصرف‌شده', faNum(g.hintsUsed), '', '#f5b73b'),
        statCard('برد / باخت / مساوی', fa(g.wins) + ' / ' + fa(g.losses) + ' / ' + fa(g.draws), done ? fa(Math.round((g.wins / done) * 100)) + '٪ برد' : '', '#14b8a6')
      ]));
      wrap.appendChild(h('div', { style: 'height:16px' }));
      var hmax = g.groupsHistogram.reduce(function (m, x) { return Math.max(m, x); }, 0);
      wrap.appendChild(h('div', { class: 'cols' }, [
        h('section', { class: 'card' }, [h('h2', { text: 'چند گروه از ۴ تا پیدا شده؟' })].concat(g.groupsHistogram.map(function (n, i) { return barRow(fa(i) + ' گروه', n, hmax, g.plays ? fa(Math.round((n / g.plays) * 100)) + '٪' : ''); }))),
        h('section', { class: 'card' }, [h('h2', { text: 'به تفکیک حالت بازی' })].concat(g.byMode.length ? g.byMode.map(function (m) { return h('div', { class: 'kv' }, [h('span', { text: MODE_FA[m.mode] || m.mode }), h('span', { class: 'muted', style: 'font-size:12.5px', text: fa(m.wins) + ' برد · ' + fa(m.groupsSolved) + ' گروه · ' + fa(m.mistakes) + ' اشتباه' }), h('b', { class: 'num', text: faNum(m.plays) })]); }) : [empty('بازی‌ای ثبت نشده')]))
      ]));
      wrap.appendChild(h('div', { style: 'height:16px' }));
      wrap.appendChild(h('section', { class: 'card flush' }, [h('div', { class: 'card-h' }, [h('h2', { text: 'پاداش حساب‌ها از بازی گروهی' }), h('div', { class: 'sub', text: 'امتیاز گروه روی حساب اصلی: XP و سکه با سقف روزانه (فقط حساب بزرگسال). بازه‌ی انتخاب‌شده' })]),
        d.rewards.top.length ? simpleTable(['بازیکن', 'امتیاز', 'سکه', 'XP'], d.rewards.top.map(function (t) { return [t.nickname || t.userId, faNum(t.points), faNum(t.coins), faNum(t.xp)]; })) : empty('هنوز حسابی از بازی گروهی پاداش نگرفته')]));
      wrap.appendChild(h('div', { style: 'height:16px' }));
      var dmax = g.daily.reduce(function (m, x) { return Math.max(m, x.plays); }, 0);
      wrap.appendChild(h('section', { class: 'card' }, [h('h2', { text: 'بازی در هر روز' }), h('div', { class: 'sub', text: 'روز به وقت تهران؛ حداکثر ۶۰ روز اخیر' })].concat(g.daily.length ? g.daily.map(function (x) { return barRow(fa(x.day), x.plays, dmax, fa(x.players) + ' بازیکن'); }) : [empty('بازی‌ای ثبت نشده')])));
      wrap.appendChild(h('div', { style: 'height:16px' }));
      wrap.appendChild(h('section', { class: 'card flush' }, [h('div', { class: 'card-h' }, [h('h2', { text: 'پرتکرارترین پازل‌ها' })]),
        g.topPuzzles.length ? simpleTable(['شناسه‌ی پازل', 'بار بازی', 'برد', 'اشتباه'], g.topPuzzles.map(function (p) { return [h('span', { class: 'ltr', text: p.puzzleId.slice(0, 8) }), faNum(p.plays), faNum(p.wins), faNum(p.mistakes)]; })) : empty('بازی‌ای ثبت نشده')]));
    });
  }
  draw();
};

VIEWS.playerstats = function (root) {
  var days = 30, sort = 'plays';
  root.appendChild(pageHead('آمار بازیکن‌ها', 'هر بازیکن چند پازل بازی کرده، چند گروه پیدا کرده، چند بار اشتباه یا راهنما گرفته و چند پازل متفاوت مصرف کرده'));
  var bar = h('div', { class: 'toolbar' }), wrap = h('div'); root.appendChild(bar); root.appendChild(wrap);
  var SORTS = [['plays', 'بیشترین بازی'], ['wins', 'بیشترین برد'], ['groups', 'بیشترین گروه'], ['mistakes', 'بیشترین اشتباه'], ['hints', 'بیشترین راهنما'], ['puzzles', 'بیشترین پازل متفاوت'], ['recent', 'تازه‌ترین بازی']];
  function draw() {
    clear(bar);
    bar.appendChild(daysPicker(days, function (n) { days = n; draw(); }));
    var s = h('select', { 'aria-label': 'ترتیب' }, SORTS.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
    s.value = sort; s.onchange = function () { sort = s.value; draw(); }; bar.appendChild(s);
    clear(wrap);
    api('/admin/stats/players?limit=100&days=' + days + '&sort=' + sort).then(function (r) {
      if (r.status === 404) return wrap.appendChild(banner('info', 'آمار فقط وقتی دیتابیس وصل باشد نمایش داده می‌شود.'));
      if (!r.ok) return fail(r);
      if (!r.body.players.length) return wrap.appendChild(empty('در این بازه بازی‌ای ثبت نشده'));
      wrap.appendChild(simpleTable(['بازیکن', 'پازل', 'برد', 'باخت', 'مساوی', 'گروه پیداشده', 'اشتباه', 'راهنما', 'پازل متفاوت', 'آخرین بازی'], r.body.players.map(function (p) {
        return [p.nickname, faNum(p.plays), faNum(p.wins), faNum(p.losses), faNum(p.draws), faNum(p.groupsSolved), faNum(p.mistakes), faNum(p.hintsUsed), faNum(p.puzzlesUsed), p.lastPlayedAt ? ago(p.lastPlayedAt) : '—'];
      })));
      wrap.appendChild(h('div', { class: 'muted', style: 'font-size:12.5px', text: 'حداکثر ۱۰۰ بازیکن نمایش داده می‌شود؛ ربات‌ها شمرده نمی‌شوند.' }));
    });
  }
  draw();
};
VIEWS.botgroups = function (root) {
  var days = 30;
  root.appendChild(pageHead('گروه‌های ربات', 'گروه‌های بله و تلگرام که ربات در آن‌ها بازی می‌شود و حساب‌های تازه‌ای که از لینک گروه آمدند'));
  var bar = h('div', { class: 'toolbar' }), wrap = h('div'); root.appendChild(bar); root.appendChild(wrap);
  function draw() {
    clear(bar); bar.appendChild(daysPicker(days, function (n) { days = n; draw(); }));
    clear(wrap);
    api('/admin/stats/groups?days=' + days).then(function (r) {
      if (r.status === 404) return wrap.appendChild(banner('info', 'آمار فقط وقتی دیتابیس وصل باشد نمایش داده می‌شود.'));
      if (!r.ok) return fail(r);
      var d = r.body, g = d.groups, w = d.window, f = d.funnel;
      wrap.appendChild(h('div', { class: 'grid kpis' }, [
        statCard('گروه‌های فعال', faNum(g.active), fa(g.total) + ' کل · ' + fa(g.bale) + ' بله · ' + fa(g.telegram) + ' تلگرام', '#4f46e5'),
        statCard('گروه تازه', faNum(g.new7d), fa(g.new30d) + ' در ۳۰ روز', '#22a45d'),
        statCard('پازل گروهی', faNum(w.plays), fa(w.activeGroups) + ' گروه · ' + fa(w.won) + ' برد · ' + fa(w.lost) + ' باخت', '#ef6c3d'),
        statCard('بازیکن‌های گروهی', faNum(w.players), fa(w.priceSessions) + ' دور قیمت‌شناسی', '#14b8a6'),
        statCard('حساب تازه از لینک گروه', faNum(f.referred), fa(f.referredAll) + ' در کل', '#f5b73b'),
        statCard('حساب پاداش‌گرفته', faNum(d.rewards.paidAccounts), fa(d.rewards.linkedAll) + ' حساب وصل‌شده در کل', '#8b5cf6'),
        statCard('سکه‌ی داده‌شده از گروه', faNum(d.rewards.coins), fa(d.rewards.xp) + ' XP · ' + fa(d.rewards.questionSessions) + ' دور سؤال عمومی', '#0ea5e9')
      ]));
      wrap.appendChild(h('div', { style: 'height:16px' }));
      var base = f.referred;
      wrap.appendChild(h('section', { class: 'card' }, [h('h2', { text: 'قیف گروه به اپ' }), h('div', { class: 'sub', text: 'حساب‌هایی که اولین بار با لینک «ادامه در بازی» یک گروه دیده شدند (بازه‌ی انتخاب‌شده)' })].concat([
        barRow('حساب تازه از لینک گروه', f.referred, base, ''),
        barRow('حداقل یک پازل بازی کرده‌اند', f.referredPlayed, base, base ? fa(Math.round((f.referredPlayed / base) * 100)) + '٪' : ''),
        barRow('در ۷ روز اخیر فعال بوده‌اند', f.referredActive7d, base, base ? fa(Math.round((f.referredActive7d / base) * 100)) + '٪' : ''),
        h('div', { class: 'muted', style: 'font-size:12.5px;margin-top:8px', text: fa(f.touchedAll) + ' حساب (تازه یا قدیمی) تا حالا لینک یک گروه را باز کرده‌اند. دکمه‌ی گروه فقط در مینی‌اپ ردیابی می‌شود؛ بازدیدی که حساب نساخته در این عددها نیست.' })
      ])));
      wrap.appendChild(h('div', { style: 'height:16px' }));
      var dmax = d.daily.reduce(function (m, x) { return Math.max(m, x.plays); }, 0);
      wrap.appendChild(h('section', { class: 'card' }, [h('h2', { text: 'پازل گروهی در هر روز' }), h('div', { class: 'sub', text: 'روز به وقت تهران' })].concat(d.daily.length ? d.daily.map(function (x) { return barRow(fa(x.day), x.plays, dmax, fa(x.groups) + ' گروه'); }) : [empty('در این بازه پازل گروهی ثبت نشده')])));
      wrap.appendChild(h('div', { style: 'height:16px' }));
      wrap.appendChild(h('section', { class: 'card flush' }, [h('div', { class: 'card-h' }, [h('h2', { text: 'گروه‌های برتر' })]),
        d.top.length ? simpleTable(['گروه', 'پیام‌رسان', 'پازل', 'برد', 'بازیکن', 'دور قیمت', 'حساب تازه از گروه', 'که بازی کردند', 'وضعیت'], d.top.map(function (t) {
          return [t.title || t.chatId, t.platform === 'telegram' ? 'تلگرام' : 'بله', faNum(t.plays), faNum(t.won), faNum(t.players), faNum(t.priceSessions), faNum(t.referred), faNum(t.referredPlayed), t.removed ? 'ربات بیرون شد' : 'فعال'];
        })) : empty('هنوز ربات به گروهی اضافه نشده')]));
      wrap.appendChild(h('div', { class: 'muted', style: 'font-size:12.5px', text: 'ستون «پازل/برد/بازیکن» برای بازه‌ی انتخاب‌شده است؛ «دور قیمت» و «حساب تازه از گروه» از ابتدا. نام گروه همان است که پیام‌رسان داده.' }));
    });
  }
  draw();
};
`;
