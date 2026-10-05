/** Admin panel views: Users and the live socket view (browser JS, concatenated into one script by ../views2.ts). */
export const ADMIN_VIEWS2_USERS_JS = String.raw`/* ---------------- users ---------------- */
VIEWS.users = function (root) {
  var q = h('input', { type: 'search', placeholder: 'جستجوی اسم یا شناسه…' }), tableBox = h('div'), t, st = { filter: load('users.filter') || 'all', sort: load('users.sort') || 'lastSeen', offset: 0 };
  var FILT = [['all', 'همه'], ['new', 'تازه‌ها'], ['banned', 'مسدودها']], SORT = [['lastSeen', 'آخرین حضور'], ['created', 'تازه‌ترین'], ['coins', 'بیشترین سکه']];
  var chips = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }), sortSel = select(SORT, st.sort);
  sortSel.addEventListener('change', function () { st.sort = sortSel.value; store('users.sort', st.sort); st.offset = 0; loadU(); });
  function drawChips() { clear(chips); FILT.forEach(function (f) { chips.appendChild(h('button', { class: 'chip', 'aria-pressed': String(st.filter === f[0]), text: f[1], onclick: function () { st.filter = f[0]; store('users.filter', f[0]); st.offset = 0; drawChips(); loadU(); } })); }); }
  drawChips();
  root.appendChild(h('div', { class: 'toolbar' }, [q, chips, h('span', { style: 'flex:1' }), sortSel])); root.appendChild(tableBox);
  function loadU() {
    api('/admin/users?q=' + encodeURIComponent(q.value) + '&filter=' + st.filter + '&sort=' + st.sort + '&offset=' + st.offset).then(function (r) {
      clear(tableBox);
      if (r.status === 404) return tableBox.appendChild(empty('مدیریت کاربران روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      if (!r.body.users.length) return tableBox.appendChild(empty('کاربری پیدا نشد'));
      tableBox.appendChild(h('div', { class: 'tbl-wrap' }, [h('table', {}, [h('thead', {}, [h('tr', {}, ['کاربر', 'سکه', 'ثبت‌نام', 'آخرین حضور', 'وضعیت', ''].map(function (x) { return h('th', { text: x }); }))]),
        h('tbody', {}, r.body.users.map(function (u) { return h('tr', {}, [h('td', {}, [h('b', { text: u.nickname }), h('div', { class: 'ltr', style: 'color:var(--muted);font-size:11px', text: u.id })]), h('td', { class: 'num', text: faNum(u.balance) }), h('td', { text: ago(u.createdAt) }), h('td', { text: ago(u.lastSeenAt) }), h('td', {}, [u.isBanned ? badge('مسدود', 'b-bad') : badge('فعال', 'b-ok')]), h('td', {}, [h('button', { class: 'btn sm', text: 'مدیریت', onclick: function () { userModal(u.id, loadU); } })])]); }))])]));
      tableBox.appendChild(h('div', { class: 'toolbar', style: 'justify-content:center' }, [
        st.offset > 0 ? h('button', { class: 'btn sm', text: '← قبلی', onclick: function () { st.offset = Math.max(0, st.offset - 50); loadU(); } }) : null,
        r.body.users.length === 50 ? h('button', { class: 'btn sm', text: 'بعدی →', onclick: function () { st.offset += 50; loadU(); } }) : null
      ]));
    });
  }
  q.addEventListener('input', function () { clearTimeout(t); st.offset = 0; t = setTimeout(loadU, 250); });
  loadU();
};
var GENDER_FA = { female: 'خانم', male: 'آقا' };
function userModal(id, done) {
  var box = h('div', { style: 'display:flex;flex-direction:column;gap:14px' });
  modal('کاربر', box, [{ label: 'بستن', run: function () { done(); } }]);
  function draw() {
    api('/admin/users/' + id).then(function (r) {
      clear(box);
      if (!r.ok) return fail(r);
      var u = r.body;
      var delta = h('input', { type: 'number', placeholder: 'مثلاً 50 یا -20' }), reason = h('input', { type: 'text', placeholder: 'دلیل مسدودی (اختیاری)', maxlength: 200 });
      var nick = h('input', { type: 'text', value: u.nickname, maxlength: 30 }), note = h('input', { type: 'text', placeholder: 'یادداشت خصوصی برای ادمین‌ها', maxlength: 500 }), ledger = h('div');
      api('/admin/users/' + id + '/ledger').then(function (x) { clear(ledger); if (!x.ok || !x.body.entries.length) return ledger.appendChild(empty('تراکنشی نیست')); x.body.entries.forEach(function (e) { ledger.appendChild(h('div', { class: 'kv' }, [h('span', { text: e.reason }), h('b', { class: 'num ltr', text: (e.delta > 0 ? '+' : '') + e.delta }), h('span', { style: 'color:var(--muted)', text: ago(e.at) })])); }); });
      box.appendChild(h('div', {}, [
        h('div', { class: 'kv' }, [h('span', { text: 'شناسه' }), h('span', { class: 'ltr', text: u.id })]),
        h('div', { class: 'kv' }, [h('span', { text: 'موجودی' }), h('b', { class: 'num', text: faNum(u.balance) + ' سکه' })]),
        h('div', { class: 'kv' }, [h('span', { text: 'ثبت‌نام' }), h('span', { text: ago(u.createdAt) })]),
        h('div', { class: 'kv' }, [h('span', { text: 'آخرین حضور' }), h('span', { text: ago(u.lastSeenAt) })]),
        h('div', { class: 'kv' }, [h('span', { text: 'دوستان' }), h('b', { class: 'num', text: fa(u.friends) })]),
        h('div', { class: 'kv' }, [h('span', { text: 'سن' }), h('span', { text: u.age === null ? 'نگفته' : fa(u.age) + ' ساله' + (u.birth ? ' · تولد ' + u.birth.year + '/' + u.birth.month + '/' + u.birth.day : '') })]),
        h('div', { class: 'kv' }, [h('span', { text: 'جنسیت (خصوصی)' }), h('span', { text: GENDER_FA[u.gender] || 'نگفته' })]),
        h('div', { class: 'kv' }, [h('span', { text: 'بله' }), u.baleLinked ? badge('وصل است', 'b-ok') : badge('وصل نیست', 'b-mute')]),
        u.isBanned ? h('div', { class: 'kv' }, [h('span', { text: 'مسدود از' }), h('span', { text: (u.bannedAt ? ago(u.bannedAt) : '') + (u.banReason ? ' — ' + u.banReason : '') })]) : null
      ]));
      box.appendChild(h('div', { style: 'display:flex;gap:8px;align-items:end' }, [field('تغییر موجودی (از طریق دفتر سکه)', delta), h('button', { class: 'btn primary', text: 'اعمال', onclick: function () {
        var d = Number(delta.value); if (!d) return toast('عدد غیرصفر وارد کن', true);
        api('/admin/users/' + id + '/coins', { method: 'POST', body: { delta: d } }).then(function (x) { if (!x.ok) return fail(x); toast('موجودی جدید: ' + faNum(x.body.balance)); draw(); });
      } })]));
      var gemDelta = h('input', { type: 'number', value: 0, style: 'width:140px' });
      box.appendChild(h('div', { style: 'display:flex;gap:8px;align-items:end' }, [field('تغییر الماس (از طریق دفتر الماس)', gemDelta), h('button', { class: 'btn primary', text: 'اعمال', onclick: function () {
        var d = Number(gemDelta.value); if (!d) return toast('عدد غیرصفر وارد کن', true);
        api('/admin/users/' + id + '/gems', { method: 'POST', body: { delta: d } }).then(function (x) { if (!x.ok) return fail(x); toast('الماس جدید: ' + faNum(x.body.balance)); gemDelta.value = 0; });
      } })]));
      box.appendChild(h('div', { style: 'display:flex;gap:8px;align-items:end' }, [field('اسم نمایشی', nick), h('button', { class: 'btn', text: 'ذخیره‌ی اسم', onclick: function () { api('/admin/users/' + id + '/identity', { method: 'PUT', body: { nickname: nick.value.trim() } }).then(function (x) { if (!x.ok) return fail(x); toast('اسم عوض شد'); draw(); }); } }),
        h('button', { class: 'btn', text: 'اسم و آواتار تصادفی', onclick: function () { if (confirm('اسم و آواتار این بازیکن با یک هویت تصادفی عوض شود؟')) api('/admin/users/' + id + '/identity', { method: 'PUT', body: {} }).then(function (x) { if (!x.ok) return fail(x); toast('هویت جدید داده شد'); draw(); }); } })]));
      box.appendChild(h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:end' }, [
        u.isBanned ? h('button', { class: 'btn ok', text: 'رفع مسدودی', onclick: function () { api('/admin/users/' + id + '/ban', { method: 'POST', body: { banned: false } }).then(function (x) { if (!x.ok) return fail(x); toast('رفع مسدودی شد'); draw(); }); } })
          : h('span', { style: 'display:flex;gap:8px;align-items:end' }, [reason, h('button', { class: 'btn bad', text: 'مسدود کردن', onclick: function () { if (confirm('این کاربر مسدود شود؟ نشست‌هایش هم بسته می‌شود.')) api('/admin/users/' + id + '/ban', { method: 'POST', body: { banned: true, reason: reason.value.trim() || null } }).then(function (x) { if (!x.ok) return fail(x); toast('مسدود شد'); draw(); }); } })]),
        h('button', { class: 'btn', text: 'خروج از همه‌ی دستگاه‌ها', onclick: function () { if (confirm('همه‌ی نشست‌های این بازیکن بسته شود؟ دفعه‌ی بعد دوباره وارد می‌شود.')) api('/admin/users/' + id + '/logout', { method: 'POST', body: {} }).then(function (x) { if (!x.ok) return fail(x); toast('نشست‌ها بسته شد'); }); } })
      ]));
      var notes = h('div');
      u.notes.forEach(function (n) { notes.appendChild(h('div', { class: 'kv' }, [h('span', { text: n.note }), h('span', { style: 'color:var(--muted);font-size:12px', text: ago(n.at) }), h('button', { class: 'btn bad sm', text: 'حذف', onclick: function () { api('/admin/user-notes/' + n.id, { method: 'DELETE' }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })])); });
      box.appendChild(h('div', {}, [h('div', { text: 'یادداشت‌های ادمین', style: 'font-weight:700;margin-bottom:6px' }), notes, h('div', { style: 'display:flex;gap:8px;margin-top:6px' }, [note, h('button', { class: 'btn', text: 'افزودن', onclick: function () { if (!note.value.trim()) return; api('/admin/users/' + id + '/notes', { method: 'POST', body: { note: note.value.trim() } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })])]));
      var bbox = h('div');
      box.appendChild(h('div', {}, [h('div', { text: 'نشان‌ها، اخطارها و سکوت', style: 'font-weight:700;margin-bottom:6px' }), bbox]));
      Promise.all([api('/admin/users/' + id + '/badges'), api('/admin/badges')]).then(function (rs) {
        clear(bbox);
        if (!rs[0].ok || !rs[1].ok) return bbox.appendChild(empty('این بخش روی سرور فعال نیست'));
        var me = rs[0].body, cat = rs[1].body.badges;
        me.earned.forEach(function (b) { bbox.appendChild(h('div', { class: 'kv' }, [h('span', { text: b.titleFa + (b.perk !== 'none' ? ' · ' + b.perk : '') }), h('button', { class: 'btn bad sm', text: 'پس‌گرفتن', onclick: function () { api('/admin/users/' + id + '/badges/' + b.id, { method: 'DELETE' }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })])); });
        var pick = select(cat.map(function (b) { return [b.id, b.titleFa]; }), cat[0] && cat[0].id);
        bbox.appendChild(h('div', { style: 'display:flex;gap:8px;margin:6px 0' }, [pick, h('button', { class: 'btn', text: 'دادن نشان', onclick: function () { api('/admin/users/' + id + '/badges', { method: 'POST', body: { badgeId: pick.value } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })]));
        me.notices.forEach(function (n) { bbox.appendChild(h('div', { class: 'kv' }, [badge(n.kind === 'warning' ? 'اخطار' : 'تشویق', n.kind === 'warning' ? 'b-bad' : 'b-ok'), h('span', { text: n.text }), h('span', { style: 'color:var(--muted);font-size:12px', text: (n.by === 'agent' ? 'آجان · ' : 'ادمین · ') + ago(n.createdAt) })])); });
        var text = h('input', { type: 'text', placeholder: 'متن اخطار یا تشویق', maxlength: 300 });
        bbox.appendChild(h('div', { style: 'display:flex;gap:8px;margin-top:6px' }, [text,
          h('button', { class: 'btn bad', text: 'اخطار', onclick: function () { api('/admin/users/' + id + '/notices', { method: 'POST', body: { kind: 'warning', text: text.value } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } }),
          h('button', { class: 'btn ok', text: 'تشویق', onclick: function () { api('/admin/users/' + id + '/notices', { method: 'POST', body: { kind: 'commendation', text: text.value } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })]));
        var mins = h('input', { type: 'number', value: 30, min: 1, style: 'width:90px' }), why = h('input', { type: 'text', placeholder: 'دلیل سکوت', maxlength: 200 });
        bbox.appendChild(h('div', { style: 'display:flex;gap:8px;margin-top:6px;align-items:center;flex-wrap:wrap' }, [
          me.muted ? badge('ساکت تا ' + new Date(me.muted.until).toLocaleString('fa-IR'), 'b-warn') : null,
          mins, h('span', { text: 'دقیقه' }), why,
          h('button', { class: 'btn', text: 'سکوت در چت', onclick: function () { api('/admin/users/' + id + '/mute', { method: 'POST', body: { minutes: +mins.value, reason: why.value } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } }),
          me.muted ? h('button', { class: 'btn ok', text: 'برداشتن سکوت', onclick: function () { api('/admin/users/' + id + '/mute', { method: 'DELETE' }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } }) : null]));
      });
      box.appendChild(h('div', {}, [h('div', { text: 'آخرین تراکنش‌ها', style: 'font-weight:700;margin-bottom:6px' }), ledger]));
    });
  }
  draw();
}

/* ---------------- socket + audit ---------------- */
VIEWS.socket = function (root) {
  var box = h('div'), timer;
  root.appendChild(box);
  function pull() {
    if (S.route !== 'socket') return clearInterval(timer);
    api('/admin/socket').then(function (r) {
      if (r.status === 404) { clearInterval(timer); clear(box); return box.appendChild(empty('سرویس سوکت روی این سرور فعال نیست')); }
      if (!r.ok) return; var s = r.body; clear(box);
      box.appendChild(h('div', { class: 'grid' }, [statCard('اتصال فعال', fa(s.connections), '', '#3fc1f0'), statCard('بیشترین اتصال همزمان', fa(s.peakConnections), '', '#a66bf0'), statCard('کل اتصال‌ها', faNum(s.totalConnections), '', '#7ed957'), statCard('اتصال ردشده', fa(s.rejectedHandshakes), 'توکن نامعتبر', '#ff4d8d'), statCard('در صف', fa(s.queueLength), 'بیشترین انتظار ' + fa(s.longestWaitSec) + ' ثانیه', '#ffc93c'), statCard('مسابقه فعال', fa(s.activeMatches), '', '#ff7a3d'), statCard('زمان روشن بودن', fa(Math.floor(s.uptimeSec / 3600)) + ' ساعت', fa(Math.floor((s.uptimeSec % 3600) / 60)) + ' دقیقه', '#3fc1f0')]));
    });
  }
  pull(); timer = setInterval(pull, 3000);
};
`;
