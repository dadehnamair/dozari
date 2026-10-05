/** Players (list + record drawer), settings (searchable) and the audit log. */
export const ADMIN_VIEWS3_JS = String.raw`
/* ---------------- users ---------------- */
VIEWS.users = function (root) {
  var st = { q: '', filter: load('users.filter') || 'all', sort: load('users.sort') || 'lastSeen', track: load('users.track') || '', offset: 0 };
  var out = h('div');
  var search = searchBox('جستجوی اسم یا شناسه…', function (v) { st.q = v; st.offset = 0; pull(); });
  var filt = seg([['all', 'همه'], ['new', 'تازه‌ها'], ['banned', 'مسدودها']], st.filter, function (v) { st.filter = v; store('users.filter', v); st.offset = 0; pull(); });
  var sortSel = select([['lastSeen', 'مرتب‌سازی: آخرین حضور'], ['created', 'مرتب‌سازی: تازه‌ترین'], ['coins', 'مرتب‌سازی: بیشترین سکه']], st.sort);
  sortSel.addEventListener('change', function () { st.sort = sortSel.value; store('users.sort', st.sort); st.offset = 0; pull(); });
  var trackSel = select([['', 'همه‌ی رده‌های سنی'], ['kid', 'کودک'], ['teen', 'نوجوان'], ['adult', 'بزرگسال']], st.track);
  trackSel.addEventListener('change', function () { st.track = trackSel.value; store('users.track', st.track); st.offset = 0; pull(); });
  root.appendChild(h('div', { class: 'toolbar' }, [search, filt, h('span', { style: 'flex:1' }), trackSel, sortSel]));
  root.appendChild(out);
  function pull() {
    api('/admin/users?q=' + encodeURIComponent(st.q) + '&filter=' + st.filter + '&sort=' + st.sort + (st.track ? '&track=' + st.track : '') + '&offset=' + st.offset).then(function (r) {
      clear(out);
      if (r.status === 404) return out.appendChild(empty('مدیریت کاربران روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      var rows = r.body.users;
      out.appendChild(dtable([
        { label: 'کاربر', render: function (u) { return h('div', { class: 'user-cell' }, [avatarDisc(u.avatarKey, 32), h('div', {}, [h('b', { text: u.nickname }), h('small', { class: 'ltr', text: u.id.slice(0, 13) + '…' })])]); } },
        { label: 'سکه', cls: 'num', render: function (u) { return faNum(u.balance); } },
        { label: 'ثبت‌نام', render: function (u) { return ago(u.createdAt); } },
        { label: 'آخرین حضور', render: function (u) { return ago(u.lastSeenAt); } },
        { label: 'وضعیت', render: function (u) { return u.isBanned ? badge('مسدود', 'b-bad') : badge('فعال', 'b-ok'); } },
        { label: '', render: function (u) { return h('button', { class: 'btn sm', text: 'مدیریت', onclick: function () { userDrawer(u.id, pull); } }); } }
      ], rows, { onRow: function (u) { userDrawer(u.id, pull); }, empty: 'کاربری پیدا نشد' }));
      if (st.offset > 0 || rows.length === 50) {
        out.appendChild(h('div', { class: 't-foot' }, [h('span', { text: 'ردیف ' + fa(st.offset + 1) + ' تا ' + fa(st.offset + rows.length) }),
          h('span', { style: 'display:flex;gap:6px' }, [
            st.offset > 0 ? h('button', { class: 'btn sm', text: 'قبلی', onclick: function () { st.offset = Math.max(0, st.offset - 50); pull(); } }) : null,
            rows.length === 50 ? h('button', { class: 'btn sm', text: 'بعدی', onclick: function () { st.offset += 50; pull(); } }) : null])]));
      }
    });
  }
  pull();
};
var GENDER_FA = { female: 'خانم', male: 'آقا' };
function userDrawer(id, done) {
  var dw = drawer('کاربر', id), tab = 'overview', cache = null;
  dw.onClose(function () { if (done) done(); });
  var TABS = [['overview', 'نمای کلی'], ['account', 'حساب و تماس'], ['items', 'بازی و آیتم‌ها'], ['coins', 'سکه و الماس'], ['mod', 'نظارت'], ['notes', 'یادداشت']];
  function drawTabs() {
    clear(dw.tabsEl); dw.tabsEl.hidden = false;
    TABS.forEach(function (t) { dw.tabsEl.appendChild(h('button', { type: 'button', 'aria-current': tab === t[0] ? 'page' : null, text: t[1], onclick: function () { tab = t[0]; paint(); } })); });
  }
  function reload() {
    api('/admin/users/' + id).then(function (r) {
      if (!r.ok) { fail(r); return dw.close(); }
      cache = r.body;
      var head = dw.body.parentNode.querySelector('header h3');
      if (head) head.textContent = cache.nickname;
      paint();
    });
  }
  function act(path, opts, msg) { return api(path, opts).then(function (x) { if (!x.ok) { fail(x); return x; } if (msg) toast(msg); reload(); return x; }); }
  function paint() {
    drawTabs();
    var u = cache, b = clear(dw.body);
    if (!u) return;
    if (tab === 'overview') {
      b.appendChild(h('div', { style: 'display:flex;gap:14px;align-items:center' }, [avatarDisc(u.avatarKey, 58), h('div', {}, [h('div', { style: 'font-size:18px;font-weight:700', text: u.nickname }), u.isBanned ? badge('مسدود', 'b-bad') : badge('فعال', 'b-ok')])]));
      if (u.isBanned) b.appendChild(banner('bad', 'مسدود' + (u.bannedAt ? ' از ' + ago(u.bannedAt) : '') + (u.banReason ? ' — ' + u.banReason : '')));
      b.appendChild(defs([
        ['شناسه', h('span', { class: 'ltr', text: u.id })], ['موجودی', faNum(u.balance) + ' سکه'], ['ثبت‌نام', ago(u.createdAt)], ['آخرین حضور', ago(u.lastSeenAt)],
        ['دوستان', fa(u.friends)], ['سن', u.age === null || u.age === undefined ? 'نگفته' : fa(u.age) + ' ساله' + (u.birth ? ' · تولد ' + u.birth.year + '/' + u.birth.month + '/' + u.birth.day : '')], ['جنسیت (خصوصی)', GENDER_FA[u.gender] || 'نگفته'], ['بله', u.baleLinked ? badge('وصل است', 'b-ok') : badge('وصل نیست', 'b-mute')]
      ]));
      var nick = h('input', { type: 'text', value: u.nickname, maxlength: 30, 'aria-label': 'اسم نمایشی' });
      b.appendChild(h('div', {}, [sectionTitle('اسم و هویت'), h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, [h('div', { style: 'flex:1;min-width:160px' }, [nick]),
        h('button', { class: 'btn', text: 'ذخیره‌ی اسم', onclick: function () { act('/admin/users/' + id + '/identity', { method: 'PUT', body: { nickname: nick.value.trim() } }, 'اسم عوض شد'); } }),
        h('button', { class: 'btn', text: 'اسم و آواتار تصادفی', onclick: function () { ask('اسم و آواتار این بازیکن با یک هویت تصادفی عوض شود؟', function () { act('/admin/users/' + id + '/identity', { method: 'PUT', body: {} }, 'هویت جدید داده شد'); }); } })])]));
      var picks = h('div', { class: 'av-pick' });
      for (var ai = 1; ai <= 24; ai++) (function (key) {
        picks.appendChild(h('button', { type: 'button', title: key, 'aria-pressed': String(u.avatarKey === key), onclick: function () { act('/admin/users/' + id + '/identity', { method: 'PUT', body: { avatarKey: key } }, 'آواتار عوض شد'); } }, [avatarDisc(key, 36)]));
      })('avatar-' + (ai < 10 ? '0' : '') + ai);
      b.appendChild(h('div', {}, [sectionTitle('آواتار'), picks]));
      var reason = h('input', { type: 'text', placeholder: 'دلیل مسدودی (اختیاری)', maxlength: 200, 'aria-label': 'دلیل مسدودی' });
      b.appendChild(h('div', {}, [sectionTitle('دسترسی'),
        u.isBanned ? h('button', { class: 'btn ok', text: 'رفع مسدودی', onclick: function () { act('/admin/users/' + id + '/ban', { method: 'POST', body: { banned: false } }, 'رفع مسدودی شد'); } })
          : h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, [h('div', { style: 'flex:1;min-width:160px' }, [reason]), h('button', { class: 'btn bad', text: 'مسدود کردن', onclick: function () { ask('این کاربر مسدود شود؟ نشست‌هایش هم بسته می‌شود.', function () { act('/admin/users/' + id + '/ban', { method: 'POST', body: { banned: true, reason: reason.value.trim() || null } }, 'مسدود شد'); }, { danger: true, yes: 'مسدود کن' }); } })]),
        h('div', { style: 'margin-top:10px' }, [h('button', { class: 'btn', text: 'خروج از همه‌ی دستگاه‌ها', onclick: function () { ask('همه‌ی نشست‌های این بازیکن بسته شود؟ دفعه‌ی بعد دوباره وارد می‌شود.', function () { api('/admin/users/' + id + '/logout', { method: 'POST', body: {} }).then(function (x) { if (!x.ok) return fail(x); toast('نشست‌ها بسته شد'); }); }); } })])]));
    } else if (tab === 'account') {
      var a = u.account || {}, dash = function (x) { return x === null || x === undefined || x === '' ? h('span', { class: 'muted', text: 'ثبت نشده' }) : x; };
      var hidden = a.phone === null && a.email === null && a.deviceId === null;
      if (hidden) b.appendChild(banner('info', 'اطلاعات تماس (شماره، ایمیل، شناسه‌ی دستگاه) فقط برای نقش‌های «پشتیبان» و «مالک» نمایش داده می‌شود.'));
      b.appendChild(sectionTitle('هویت'));
      b.appendChild(defs([
        ['اسم نمایشی', u.nickname], ['شناسه‌ی عمومی (handle)', dash(a.handle && h('span', { class: 'ltr', text: '@' + a.handle }))],
        ['آواتار', h('span', { style: 'display:inline-flex;gap:8px;align-items:center' }, [avatarDisc(u.avatarKey, 26), h('span', { class: 'ltr', text: u.avatarKey })])],
        ['شهر', dash(a.city)], ['رده‌ی سنی', { kid: 'کودک', teen: 'نوجوان', adult: 'بزرگسال' }[u.ageTrack] || u.ageTrack], ['حساب ربات؟', a.isBot ? badge('بله', 'b-warn') : 'خیر']
      ]));
      b.appendChild(sectionTitle('تماس'));
      b.appendChild(defs([
        ['شماره‌ی موبایل', hidden ? h('span', { class: 'muted', text: 'پنهان' }) : dash(a.phone && h('span', { class: 'ltr', text: a.phone }))],
        ['تأیید شماره', a.phoneVerifiedAt ? badge('تأییدشده ' + ago(a.phoneVerifiedAt), 'b-ok') : badge('تأییدنشده', 'b-mute')],
        ['ایمیل', hidden ? h('span', { class: 'muted', text: 'پنهان' }) : dash(a.email && h('span', { class: 'ltr', text: a.email }))],
        ['بله', u.baleLinked ? badge('وصل است' + (a.baleLinkedAt ? ' · ' + ago(a.baleLinkedAt) : ''), 'b-ok') : badge('وصل نیست', 'b-mute')],
        ['شناسه‌ی دستگاه', hidden ? h('span', { class: 'muted', text: 'پنهان' }) : dash(a.deviceId && h('span', { class: 'ltr', style: 'word-break:break-all', text: a.deviceId }))]
      ]));
      var cl = a.client, PLAT = { android: 'اندروید', ios: 'آی‌اواس', web: 'وب (مرورگر)' }, STORE_FA = { myket: 'مایکت', bazaar: 'بازار', bale: 'بله' };
      b.appendChild(sectionTitle('آخرین دستگاه'));
      b.appendChild(cl ? defs([
        ['پلتفرم', PLAT[cl.platform] || cl.platform], ['نسخه‌ی سیستم‌عامل', dash(cl.osVersion && h('span', { class: 'ltr', text: cl.osVersion }))],
        ['نسخه‌ی اپ (build)', cl.appBuild ? fa(cl.appBuild) : dash(null)], ['مرجع نصب (بازار فعلی)', cl.store ? STORE_FA[cl.store] || cl.store : (cl.platform === 'web' ? 'وب' : 'نامشخص / مستقیم')],
        ['مرجع اولین نصب', cl.firstStore ? STORE_FA[cl.firstStore] || cl.firstStore : (cl.platform === 'web' ? 'وب' : 'نامشخص / مستقیم') + (cl.firstBuild ? ' · build ' + fa(cl.firstBuild) : '')],
        ['اولین بار دیده شد', ago(cl.firstSeenAt)], ['آخرین گزارش', ago(cl.updatedAt)]
      ]) : h('div', { class: 'muted', text: 'هنوز دستگاهی گزارش نشده؛ بعد از اولین درخواست یک نسخه‌ی به‌روز اپ ثبت می‌شود.' }));
      b.appendChild(sectionTitle('حریم خصوصی و دسترسی'));
      b.appendChild(defs([
        ['جنسیت (خصوصی)', GENDER_FA[u.gender] || 'نگفته'], ['سن', u.age === null || u.age === undefined ? 'نگفته' : fa(u.age) + ' ساله' + (u.birth ? ' · تولد ' + u.birth.year + '/' + u.birth.month + '/' + u.birth.day : '')],
        ['نمایش سن به دیگران', a.showAge ? 'بله' : 'خیر'], ['پیدا شدن با شماره', a.findableByPhone ? 'بله' : 'خیر'], ['اعلان تولد دوستان', a.notifyBirthday ? 'روشن' : 'خاموش'],
        ['چت آزاد', a.chatUnlockedAt ? badge('باز شده ' + ago(a.chatUnlockedAt), 'b-ok') : badge('قفل (کد معرف نزده)', 'b-mute')],
        ['انتخاب رده‌ی سنی', a.ageTrackSetAt ? ago(a.ageTrackSetAt) : 'هنوز انتخاب نکرده']
      ]));
    } else if (tab === 'items') {
      var ac = u.account || {}, stt = ac.stats || {}, EFF = { hint_token: 'توکن راهنما', wheel_spin: 'چرخش گردونه' };
      b.appendChild(h('div', { class: 'stat-row' }, [['سکه', faNum(u.balance)], ['الماس', faNum(ac.gems || 0)], ['XP', faNum(stt.xp || 0)], ['بازی', faNum(stt.games || 0)], ['برد', faNum(stt.wins || 0)], ['باخت', faNum(stt.losses || 0)], ['مساوی', faNum(stt.draws || 0)]].map(function (x) { return h('div', {}, [h('b', { class: 'num', text: x[1] }), h('span', { text: x[0] })]); })));
      b.appendChild(h('div', {}, [sectionTitle('موجودی آیتم‌ها'), (ac.inventory || []).length ? h('div', {}, ac.inventory.map(function (i) { return h('div', { class: 'kv' }, [h('span', { text: EFF[i.effect] || i.effect }), h('b', { class: 'num', text: faNum(i.qty) })]); })) : h('div', { class: 'muted', text: 'آیتمی ندارد' })]));
      b.appendChild(h('div', {}, [sectionTitle('لباس و کلاه‌ها'), (ac.cosmetics || []).length ? h('div', {}, ac.cosmetics.map(function (c) { return h('div', { class: 'kv' }, [h('span', {}, [c.titleFa, ' ', c.slot ? badge(c.slot, 'b-mute') : null, ' ', c.equipped ? badge('تن‌شده', 'b-ok') : null]), h('span', { class: 'muted', style: 'font-size:12.5px', text: (c.source === 'wheel' ? 'گردونه · ' : '') + ago(c.at) })]); })) : h('div', { class: 'muted', text: 'چیزی نخریده' })]));
      b.appendChild(h('div', {}, [sectionTitle('آخرین خریدهای فروشگاه'), (ac.purchases || []).length ? h('div', {}, ac.purchases.map(function (p) { return h('div', { class: 'kv' }, [h('span', { text: p.titleFa }), h('b', { class: 'num', text: p.priceGems ? faNum(p.priceGems) + ' الماس' : faNum(p.priceCoins) + ' سکه' }), h('span', { class: 'muted', style: 'font-size:12.5px', text: ago(p.at) })]); })) : h('div', { class: 'muted', text: 'خریدی نکرده' })]));
    } else if (tab === 'coins') {
      var delta = h('input', { type: 'number', placeholder: 'مثلاً 50 یا -20', 'aria-label': 'تغییر موجودی' }), ledger = h('div');
      b.appendChild(h('div', { class: 'stat-card' }, [h('div', { class: 'l', text: 'موجودی فعلی' }), h('div', { class: 'n num', text: faNum(u.balance) }), h('div', { class: 'd', text: 'سکه' })]));
      b.appendChild(h('div', {}, [sectionTitle('تغییر موجودی (از طریق دفتر سکه، با ثبت در گزارش)'), h('div', { style: 'display:flex;gap:8px' }, [h('div', { style: 'flex:1' }, [delta]), h('button', { class: 'btn primary', text: 'اعمال', onclick: function () {
        var d = Number(delta.value); if (!d) return toast('عدد غیرصفر وارد کن', true);
        ask((d > 0 ? 'اضافه کردن ' : 'کم کردن ') + faNum(Math.abs(d)) + ' سکه ' + (d > 0 ? 'به ' : 'از ') + u.nickname + '؟', function () { api('/admin/users/' + id + '/coins', { method: 'POST', body: { delta: d } }).then(function (x) { if (!x.ok) return fail(x); toast('موجودی جدید: ' + faNum(x.body.balance)); reload(); }); });
      } })])]));
      var gemDelta = h('input', { type: 'number', placeholder: 'مثلاً 5 یا -2', 'aria-label': 'تغییر الماس' });
      b.appendChild(h('div', {}, [sectionTitle('تغییر الماس (از طریق دفتر الماس)'), h('div', { style: 'display:flex;gap:8px' }, [h('div', { style: 'flex:1' }, [gemDelta]), h('button', { class: 'btn primary', text: 'اعمال', onclick: function () {
        var d = Number(gemDelta.value); if (!d) return toast('عدد غیرصفر وارد کن', true);
        ask((d > 0 ? 'اضافه کردن ' : 'کم کردن ') + faNum(Math.abs(d)) + ' الماس ' + (d > 0 ? 'به ' : 'از ') + u.nickname + '؟', function () { api('/admin/users/' + id + '/gems', { method: 'POST', body: { delta: d } }).then(function (x) { if (!x.ok) return fail(x); toast('الماس جدید: ' + faNum(x.body.balance)); gemDelta.value = ''; }); });
      } })])]));
      b.appendChild(h('div', {}, [sectionTitle('آخرین تراکنش‌ها'), ledger]));
      api('/admin/users/' + id + '/ledger').then(function (x) {
        if (!x.ok || !x.body.entries.length) return ledger.appendChild(empty('تراکنشی نیست'));
        x.body.entries.forEach(function (e) { ledger.appendChild(h('div', { class: 'kv' }, [h('span', { text: e.reason }), h('b', { class: 'num ltr', style: 'color:' + (e.delta > 0 ? 'var(--ok)' : 'var(--bad)'), text: (e.delta > 0 ? '+' : '') + e.delta }), h('span', { class: 'muted', style: 'font-size:12.5px', text: ago(e.at) })])); });
      });
    } else if (tab === 'mod') {
      var bbox = h('div', { class: 'muted', text: 'در حال بارگذاری…' });
      b.appendChild(bbox);
      Promise.all([api('/admin/users/' + id + '/badges'), api('/admin/badges')]).then(function (rs) {
        clear(bbox); bbox.className = ''; bbox.style.cssText = 'display:flex;flex-direction:column;gap:18px';
        if (!rs[0].ok || !rs[1].ok) return bbox.appendChild(empty('این بخش روی سرور فعال نیست'));
        var me = rs[0].body, cat = rs[1].body.badges;
        var bs = h('div');
        if (!me.earned.length) bs.appendChild(h('div', { class: 'muted', text: 'نشانی ندارد' }));
        me.earned.forEach(function (x) { bs.appendChild(h('div', { class: 'kv' }, [h('span', { text: x.titleFa + (x.perk !== 'none' ? ' · ' + x.perk : '') }), h('button', { class: 'btn bad sm', text: 'پس‌گرفتن', onclick: function () { act('/admin/users/' + id + '/badges/' + x.id, { method: 'DELETE' }); } })])); });
        var pick = select(cat.map(function (x) { return [x.id, x.titleFa]; }), cat[0] && cat[0].id);
        bs.appendChild(h('div', { style: 'display:flex;gap:8px;margin-top:8px' }, [pick, h('button', { class: 'btn', text: 'دادن نشان', onclick: function () { act('/admin/users/' + id + '/badges', { method: 'POST', body: { badgeId: pick.value } }); } })]));
        bbox.appendChild(h('div', {}, [sectionTitle('نشان‌ها'), bs]));
        var ns = h('div');
        if (!me.notices.length) ns.appendChild(h('div', { class: 'muted', text: 'اخطار یا تشویقی ثبت نشده' }));
        me.notices.forEach(function (n) { ns.appendChild(h('div', { class: 'kv' }, [badge(n.kind === 'warning' ? 'اخطار' : 'تشویق', n.kind === 'warning' ? 'b-bad' : 'b-ok'), h('span', { style: 'flex:1', text: n.text }), h('span', { class: 'muted', style: 'font-size:12px', text: (n.by === 'agent' ? 'آجان · ' : 'ادمین · ') + ago(n.createdAt) })])); });
        var text = h('input', { type: 'text', placeholder: 'متن اخطار یا تشویق', maxlength: 300, 'aria-label': 'متن' });
        ns.appendChild(h('div', { style: 'display:flex;gap:8px;margin-top:8px;flex-wrap:wrap' }, [h('div', { style: 'flex:1;min-width:160px' }, [text]),
          h('button', { class: 'btn bad', text: 'اخطار', onclick: function () { act('/admin/users/' + id + '/notices', { method: 'POST', body: { kind: 'warning', text: text.value } }, 'اخطار ثبت شد'); } }),
          h('button', { class: 'btn ok', text: 'تشویق', onclick: function () { act('/admin/users/' + id + '/notices', { method: 'POST', body: { kind: 'commendation', text: text.value } }, 'تشویق ثبت شد'); } })]));
        bbox.appendChild(h('div', {}, [sectionTitle('اخطار و تشویق'), ns]));
        var mins = h('input', { type: 'number', value: 30, min: 1, style: 'width:90px', 'aria-label': 'دقیقه' }), why = h('input', { type: 'text', placeholder: 'دلیل سکوت', maxlength: 200, 'aria-label': 'دلیل سکوت' });
        bbox.appendChild(h('div', {}, [sectionTitle('سکوت در چت'), me.muted ? h('div', { style: 'margin-bottom:8px' }, [badge('ساکت تا ' + new Date(me.muted.until).toLocaleString('fa-IR'), 'b-warn'), ' ', h('button', { class: 'btn ok sm', text: 'برداشتن سکوت', onclick: function () { act('/admin/users/' + id + '/mute', { method: 'DELETE' }, 'سکوت برداشته شد'); } })]) : null,
          h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [mins, h('span', { text: 'دقیقه' }), h('div', { style: 'flex:1;min-width:140px' }, [why]), h('button', { class: 'btn', text: 'ساکت کن', onclick: function () { act('/admin/users/' + id + '/mute', { method: 'POST', body: { minutes: +mins.value, reason: why.value } }, 'ساکت شد'); } })])]));
      });
    } else {
      var note = h('input', { type: 'text', placeholder: 'یادداشت خصوصی برای ادمین‌ها', maxlength: 500, 'aria-label': 'یادداشت' });
      b.appendChild(h('div', { style: 'display:flex;gap:8px' }, [h('div', { style: 'flex:1' }, [note]), h('button', { class: 'btn primary', text: 'افزودن', onclick: function () { if (!note.value.trim()) return; act('/admin/users/' + id + '/notes', { method: 'POST', body: { note: note.value.trim() } }); } })]));
      if (!u.notes.length) b.appendChild(empty('هنوز یادداشتی نیست'));
      u.notes.forEach(function (n) { b.appendChild(h('div', { class: 'card', style: 'margin:0;padding:12px 16px' }, [h('div', { text: n.note }), h('div', { style: 'display:flex;justify-content:space-between;margin-top:6px' }, [h('span', { class: 'muted', style: 'font-size:12px', text: ago(n.at) }), h('button', { class: 'btn bad sm', text: 'حذف', onclick: function () { act('/admin/user-notes/' + n.id, { method: 'DELETE' }); } })])])); });
    }
  }
  drawTabs();
  dw.body.appendChild(h('div', { class: 'muted', text: 'در حال بارگذاری…' }));
  reload();
}

/* ---------------- settings ---------------- */
var GROUP_FA = { app: 'مدیریت اپ', gameplay: 'بازی', scoring: 'امتیاز', profile: 'پروفایل', economy: 'اقتصاد', chart: 'نمودار', bot: 'ربات محتوا', notify: 'اعلان‌های بله', review: 'نظر در فروشگاه‌ها' };
VIEWS.settings = function (root) {
  var group = load('settings.group') || 'app', q = '', rows = [], nav = h('div', { class: 'chips', style: 'margin-bottom:14px' }), box = h('div');
  var search = searchBox('جستجو در همه‌ی تنظیم‌ها (عنوان، توضیح یا کلید)…', function (v) { q = v.trim().toLowerCase(); draw(); });
  root.appendChild(h('div', { class: 'toolbar' }, [search]));
  root.appendChild(nav); root.appendChild(box);
  function matches(r) { return (r.label + ' ' + (r.hint || '') + ' ' + r.key).toLowerCase().indexOf(q) >= 0; }
  function settingRow(r) {
    var inp = h('input', { type: r.kind === 'bool' ? 'checkbox' : 'text', dir: r.kind === 'text' ? 'auto' : 'ltr', maxlength: r.kind === 'text' ? r.max : undefined, value: Array.isArray(r.value) ? r.value.join(',') : String(r.value), checked: r.kind === 'bool' ? r.value === 1 : undefined, 'aria-label': r.label });
    var def = Array.isArray(r.default) ? r.default.join(',') : String(r.default) || '(خالی)';
    return h('div', { class: 'setting' + (r.overridden ? ' changed' : '') }, [
      h('div', {}, [h('div', { class: 'l', text: r.label + (r.unit ? ' (' + r.unit + ')' : '') }), r.hint ? h('div', { class: 'h', text: r.hint }) : null, h('div', { class: 'h ltr', text: r.key + ' · پیش‌فرض ' + def })]),
      inp,
      h('div', { style: 'display:flex;gap:6px;align-items:center' }, [
        r.overridden ? badge('تغییر‌یافته', 'b-warn') : null,
        h('button', { class: 'btn primary sm', text: 'ذخیره', onclick: function () {
          var val = r.kind === 'bool' ? (inp.checked ? 1 : 0) : inp.value;
          api('/admin/settings/' + encodeURIComponent(r.key), { method: 'PUT', body: { value: val } }).then(function (x) { if (!x.ok) return fail(x); rows = x.body.settings; toast('ذخیره شد'); draw(); });
        } }),
        r.overridden ? h('button', { class: 'btn sm', text: 'پیش‌فرض', onclick: function () { api('/admin/settings/' + encodeURIComponent(r.key), { method: 'DELETE' }).then(function (x) { if (!x.ok) return fail(x); rows = x.body.settings; toast('به پیش‌فرض برگشت'); draw(); }); } }) : null
      ])
    ]);
  }
  function draw() {
    clear(nav); clear(box);
    Object.keys(GROUP_FA).forEach(function (g) {
      var n = rows.filter(function (r) { return r.group === g && r.overridden; }).length;
      nav.appendChild(h('button', { class: 'chip', 'aria-pressed': String(!q && g === group), text: GROUP_FA[g] + (n ? ' (' + fa(n) + ' تغییر)' : ''), onclick: function () { group = g; store('settings.group', g); search.input.value = ''; q = ''; draw(); } }));
    });
    var items = q ? rows.filter(matches) : rows.filter(function (r) { return r.group === group; });
    if (q) box.appendChild(card('نتیجه‌ی جستجو', fa(items.length) + ' مورد در همه‌ی گروه‌ها', items.length ? items.map(settingRow) : [empty('تنظیمی پیدا نشد')]));
    else box.appendChild(card(GROUP_FA[group], 'تغییرها همان لحظه ذخیره می‌شود و تا چند ثانیه روی سرور اثر می‌گذارد. موردهای تغییر‌یافته با نوار زرد مشخص شده‌اند.', items.map(settingRow)));
  }
  api('/admin/settings').then(function (r) { if (r.status === 404) return root.appendChild(empty('تنظیمات روی این سرور فعال نیست (دیتابیس لازم است)')); if (!r.ok) return fail(r); rows = r.body.settings; draw(); });
};

/* ---------------- audit log ---------------- */
VIEWS.audit = function (root) {
  var entries = [], out = h('div'), q = '', who = '';
  var search = searchBox('جستجو در کار، هدف یا جزئیات…', function (v) { q = v.trim().toLowerCase(); draw(); });
  var whoSel = select([['', 'همه‌ی ادمین‌ها']], '');
  whoSel.addEventListener('change', function () { who = whoSel.value; draw(); });
  root.appendChild(h('div', { class: 'toolbar' }, [search, whoSel]));
  root.appendChild(out);
  function draw() {
    var list = entries.filter(function (e) { return (!who || (e.actor || '—') === who) && (!q || (e.action + ' ' + e.target + ' ' + (e.detail || '')).toLowerCase().indexOf(q) >= 0); });
    clear(out);
    out.appendChild(h('div', { class: 't-foot' }, [h('span', { text: fa(list.length) + ' از ' + fa(entries.length) + ' تغییر آخر' })]));
    out.appendChild(dtable([
      { label: 'زمان', sort: function (e) { return e.at; }, render: function (e) { return h('span', { title: new Date(e.at).toLocaleString('fa-IR'), text: ago(e.at) }); } },
      { label: 'چه کسی', render: function (e) { return e.actor || '—'; } },
      { label: 'کار', render: function (e) { return badge(e.action, 'b-info'); } },
      { label: 'هدف', cls: 'ltr', render: function (e) { return e.target; } },
      { label: 'جزئیات', cls: 'ltr', render: function (e) { return e.detail || ''; } }
    ], list, { empty: 'تغییری با این فیلتر پیدا نشد', pageSize: 30 }));
  }
  api('/admin/audit').then(function (r) {
    if (r.status === 404) return root.appendChild(empty('گزارش تغییرها روی این سرور فعال نیست'));
    if (!r.ok) return fail(r);
    entries = r.body.entries;
    var names = {}; entries.forEach(function (e) { names[e.actor || '—'] = 1; });
    Object.keys(names).forEach(function (n) { whoSel.appendChild(h('option', { value: n, text: n })); });
    draw();
  });
};

/* ---------------- kid word lessons (D198) ---------------- */
VIEWS.lessons = function (root) {
  var st = { status: load('lessons.status') || 'all' };
  var box = h('div');
  var filt = seg([['all', 'همه'], ['missing', 'بدون درس'], ['draft', 'پیش‌نویس'], ['approved', 'تأییدشده']], st.status, function (v) { st.status = v; store('lessons.status', v); pull(); });
  root.appendChild(h('div', { class: 'toolbar' }, [filt]));
  root.appendChild(box);
  function row(it) {
    var l = it.lesson;
    var word = h('input', { type: 'text', value: l ? l.wordFa : it.nameFa, maxlength: 60 });
    var story = h('input', { type: 'text', value: l ? l.storyFa : '', maxlength: 300, placeholder: 'یک جمله‌ی کوتاه درباره‌اش' });
    var syl = h('input', { type: 'text', value: l && l.syllablesFa ? l.syllablesFa : '', maxlength: 80, placeholder: 'هجاها (اختیاری)، مثلاً سی-ب' });
    function save() {
      api('/admin/lessons/' + it.productId, { method: 'PUT', body: { wordFa: word.value, storyFa: story.value, syllablesFa: syl.value || null } }).then(function (r) { if (!r.ok) return fail(r); toast('ذخیره شد؛ برای نمایش به بچه‌ها تأیید کن'); pull(); });
    }
    function setStatus(action) { api('/admin/lessons/' + it.productId + '/' + action, { method: 'POST', body: {} }).then(function (r) { if (!r.ok) return fail(r); toast(action === 'approve' ? 'تأیید شد' : 'به پیش‌نویس برگشت'); pull(); }); }
    var state = !l ? badge('بدون درس', 'b-mute') : l.status === 'approved' ? badge('تأییدشده', 'b-ok') : badge('پیش‌نویس', 'b-warn');
    return h('section', { class: 'card' }, [
      h('div', { style: 'display:flex;gap:10px;align-items:center;margin-bottom:8px' }, [it.iconKey ? iconTile(it.iconKey) : null, h('h2', { text: it.nameFa, style: 'margin:0' }), state]),
      h('div', { class: 'form-grid' }, [field('کلمه', word), field('داستان کوتاه', story), field('هجاها', syl)]),
      h('div', { style: 'display:flex;gap:8px;margin-top:8px' }, [
        h('button', { class: 'btn primary', text: 'ذخیره', onclick: save }),
        l && l.status !== 'approved' ? h('button', { class: 'btn ok', text: 'تأیید', onclick: function () { setStatus('approve'); } }) : null,
        l && l.status === 'approved' ? h('button', { class: 'btn', text: 'برگرداندن به پیش‌نویس', onclick: function () { setStatus('unapprove'); } }) : null
      ])
    ]);
  }
  function pull() {
    api('/admin/lessons' + (st.status === 'all' ? '' : '?status=' + st.status)).then(function (r) {
      clear(box);
      if (r.status === 404) return box.appendChild(empty('کلمه‌آموزی روی این سرور فعال نیست (دیتابیس لازم است)'));
      if (!r.ok) return fail(r);
      if (!r.body.items.length) return box.appendChild(empty('آیتمی با این فیلتر نیست', 'در «کاتالوگ محصولات» رده‌ی سنی یک آیتم را «کودک» کن تا اینجا بیاید.'));
      r.body.items.forEach(function (it) { box.appendChild(row(it)); });
    });
  }
  pull();
};

/* ---------------- age tracks overview (D198) ---------------- */
VIEWS.agetracks = function (root) {
  var TR = [['kid', 'کودک'], ['teen', 'نوجوان'], ['adult', 'بزرگسال']];
  api('/admin/age-tracks').then(function (r) {
    if (r.status === 404) return root.appendChild(empty('رده‌های سنی روی این سرور فعال نیست (دیتابیس لازم است)'));
    if (!r.ok) return fail(r);
    var d = r.body;
    root.appendChild(h('div', { class: 'callout', text: 'کلید «رده‌های سنی» در تنظیمات (گروه مدیریت اپ) را فقط وقتی روشن کن که پازل و درس کودک تأیید شده باشد.' }));
    root.appendChild(h('div', { class: 'tbl-wrap' }, [h('table', {}, [
      h('thead', {}, [h('tr', {}, ['رده', 'بازیکن', 'پازل تأییدشده', 'پازل پیش‌نویس'].map(function (x) { return h('th', { text: x }); }))]),
      h('tbody', {}, TR.map(function (t) { var p = d.puzzles[t[0]]; return h('tr', {}, [h('td', {}, [h('b', { text: t[1] })]), h('td', { class: 'num', text: faNum(d.players[t[0]]) }), h('td', { class: 'num', text: faNum(p.approved) }), h('td', { class: 'num', text: faNum(p.draft) })]); }))
    ])]));
    var k = d.kidItems;
    root.appendChild(h('section', { class: 'card' }, [
      h('h2', { text: 'کلمه‌آموزی کودک' }),
      h('div', { class: 'kv' }, [h('span', { text: 'آیتم‌های کودک' }), h('b', { class: 'num', text: faNum(k.total) })]),
      h('div', { class: 'kv' }, [h('span', { text: 'بدون درس' }), h('b', { class: 'num', text: faNum(k.missing) })]),
      h('div', { class: 'kv' }, [h('span', { text: 'پیش‌نویس' }), h('b', { class: 'num', text: faNum(k.draft) })]),
      h('div', { class: 'kv' }, [h('span', { text: 'تأییدشده' }), h('b', { class: 'num', text: faNum(k.approved) })]),
      h('div', { class: 'kv' }, [h('span', { text: 'فرزندهای وصل‌شده به ولی' }), h('b', { class: 'num', text: faNum(d.linkedChildren) })])
    ]));
  });
};
`;
