/** Admin panel views: Bots, Bale, messages, admins, audit (browser JS, concatenated into one script by ../views2.ts). */
export const ADMIN_VIEWS2_OPS_JS = String.raw`VIEWS.bots = function (root) {
  var list = h('div');
  function num(v, min, max) { return h('input', { type: 'number', value: v, min: min, max: max, style: 'width:90px' }); }
  function draw() {
    api('/admin/bots').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('بازیکن‌های ربات روی این سرور فعال نیستند'));
      if (!r.ok) return fail(r);
      if (!r.body.bots.length) return list.appendChild(empty('هنوز رباتی نساخته‌ای'));
      r.body.bots.forEach(function (b) {
        var skill = num(b.skill, 0, 100), taunt = num(b.tauntPercent, 0, 100), tmin = num(Math.round(b.thinkMinMs / 1000), 1, 60), tmax = num(Math.round(b.thinkMaxMs / 1000), 1, 60);
        function save(patch) { api('/admin/bots/' + b.userId, { method: 'PATCH', body: patch }).then(function (x) { if (!x.ok) return fail(x); toast('ذخیره شد'); draw(); }); }
        list.appendChild(h('div', { class: 'kv', style: 'flex-wrap:wrap;gap:8px;padding:8px 0;border-bottom:1px solid var(--line,#ddd)' }, [
          h('b', { text: b.nickname }), h('span', { class: 'h', text: 'لول ' + fa(b.level) + ' · ' + fa(b.games) + ' بازی · ' + fa(b.wins) + ' برد · ' + faNum(b.coins) + ' سکه' }), b.isActive ? null : badge('متوقف', 'b-warn'),
          field('مهارت', skill), field('جواب به کل‌کل ٪', taunt), field('فکر کردن (ثانیه)', h('span', { style: 'display:flex;gap:4px' }, [tmin, tmax])),
          h('button', { class: 'btn sm primary', text: 'ذخیره', onclick: function () { save({ skill: +skill.value, tauntPercent: +taunt.value, thinkMinMs: +tmin.value * 1000, thinkMaxMs: Math.max(+tmin.value, +tmax.value) * 1000 }); } }),
          h('button', { class: 'btn sm', text: b.isActive ? 'متوقف کن' : 'فعال کن', onclick: function () { save({ isActive: !b.isActive }); } })
        ]));
      });
    });
  }
  var count = num(10, 1, 50), lmin = num(2, 1, 100), lmax = num(15, 1, 100), smin = num(35, 0, 100), smax = num(80, 0, 100), wmin = num(40, 20, 85), wmax = num(62, 20, 85), tmin = num(3, 1, 60), tmax = num(12, 1, 60), taunt = num(40, 0, 100);
  var cities = h('input', { type: 'checkbox' }); cities.checked = true;
  root.appendChild(card('بازیکن‌های ربات', 'حساب‌هایی که بازی خودش بازی می‌کند و از بازیکن واقعی قابل‌تشخیص نیست: اسم، آواتار، شهر، لول، آمار، سکه و مدال طبیعی دارند، با تأخیر انسانی بازی می‌کنند و کل‌کل جواب می‌دهند. بازیکنی که چند ثانیه در صف مانده با یکی‌شان جفت می‌شود (تنظیمات «ربات» در بخش تنظیمات).', [list]));
  root.appendChild(card('ساخت گروهی', 'هر بار حداکثر ۵۰ ربات؛ اسم‌ها تکراری نیستند و فهرست اسم‌ها محدود است. مهارت یعنی چند درصد وقت‌ها گروه درست را پیدا می‌کند (هیچ‌وقت بیش از ۹۰٪).', [
    h('div', { class: 'toolbar' }, [field('تعداد', count), field('لول از', lmin), field('تا', lmax), field('مهارت از', smin), field('تا', smax)]),
    h('div', { class: 'toolbar' }, [field('درصد برد از', wmin), field('تا', wmax), field('فکر کردن از (ثانیه)', tmin), field('تا', tmax), field('جواب به کل‌کل ٪', taunt)]),
    h('div', { class: 'toolbar' }, [h('label', {}, [cities, ' شهر تصادفی هم بدهم']), h('button', { class: 'btn primary', text: 'بساز', onclick: function () {
      api('/admin/bots/generate', { method: 'POST', body: { count: +count.value, levelMin: +lmin.value, levelMax: Math.max(+lmin.value, +lmax.value), skillMin: +smin.value, skillMax: Math.max(+smin.value, +smax.value), winPercentMin: +wmin.value, winPercentMax: Math.max(+wmin.value, +wmax.value), thinkMinMs: +tmin.value * 1000, thinkMaxMs: Math.max(+tmin.value, +tmax.value) * 1000, tauntPercent: +taunt.value, withCities: cities.checked } }).then(function (x) { if (!x.ok) return fail(x); toast(fa(x.body.created) + ' ربات ساخته شد'); draw(); });
    } })])
  ]));
  draw();
};
VIEWS.bale = function (root) {
  var body = h('div'), msg = h('textarea', { placeholder: 'متن پیام برای همه‌ی بازیکنان وصل‌شده…', maxlength: 1000 }), chat = h('input', { type: 'text', dir: 'ltr', placeholder: 'شناسه‌ی چت (عدد)' });
  function draw() {
    api('/admin/bale').then(function (r) {
      clear(body);
      if (r.status === 404) return body.appendChild(empty('ربات بله روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      var d = r.body;
      body.appendChild(h('div', { class: 'grid' }, [
        statCard('وضعیت ربات', d.configured ? 'روشن' : 'خاموش', d.configured ? (d.botUsername ? '@' + d.botUsername : 'نام کاربری تنظیم نشده') : 'BALE_BOT_TOKEN تنظیم نشده', d.configured ? '#7ed957' : '#ff4d8d'),
        statCard('بازیکنان وصل‌شده', faNum(d.linked), 'کسانی که حسابشان را با کد وصل کرده‌اند', '#3fc1f0'),
        statCard('در صف ارسال', faNum(d.outbox.pending), fa(d.outbox.sent) + ' فرستاده‌شده · ' + fa(d.outbox.failed) + ' ناموفق', '#ffc93c')
      ]));
      body.appendChild(card('آخرین پیام‌ها', 'بیست پیام آخر صف ارسال', d.outbox.recent.length ? [h('div', { class: 'tbl-wrap' }, [h('table', {}, [h('thead', {}, [h('tr', {}, ['زمان', 'نوع', 'وضعیت', 'متن', 'خطا'].map(function (x) { return h('th', { text: x }); }))]),
        h('tbody', {}, d.outbox.recent.map(function (e) { return h('tr', {}, [h('td', { text: ago(e.at) }), h('td', {}, [badge(e.kind, 'b-info')]), h('td', {}, [badge(e.status === 'sent' ? 'فرستاده شد' : e.status === 'pending' ? 'در انتظار' : 'ناموفق', e.status === 'sent' ? 'b-ok' : e.status === 'pending' ? 'b-info' : 'b-bad')]), h('td', { text: e.text.slice(0, 80) }), h('td', { class: 'ltr', text: e.lastError || '' })]); }))])])] : [empty('هنوز پیامی نیست')]));
    });
  }
  root.appendChild(body);
  root.appendChild(card('پیام همگانی', 'همین متن برای همه‌ی بازیکنانی که بله را وصل کرده‌اند در صف می‌رود', [msg, h('div', { class: 'toolbar' }, [h('button', { class: 'btn primary', text: 'ارسال به همه', onclick: function () {
    if (!msg.value.trim() || !confirm('این پیام برای همه‌ی بازیکنان وصل‌شده فرستاده شود؟')) return;
    api('/admin/bale/broadcast', { method: 'POST', body: { text: msg.value.trim() } }).then(function (x) { if (!x.ok) return fail(x); toast(fa(x.body.queued) + ' پیام در صف رفت'); msg.value = ''; draw(); });
  } })])]));
  root.appendChild(card('پیام آزمایشی', 'شناسه‌ی چت خودت را بده؛ ربات یک پیام کوتاه برایت می‌فرستد', [h('div', { class: 'toolbar' }, [chat, h('button', { class: 'btn', text: 'ارسال آزمایشی', onclick: function () {
    api('/admin/bale/test', { method: 'POST', body: { chatId: chat.value.trim() } }).then(function (x) { if (!x.ok) return fail(x); toast('در صف رفت'); draw(); });
  } })])]));
  draw();
};
var CH_FA = { in_app: 'صندوق داخل اپ', bale: 'بله', sms: 'پیامک', email: 'ایمیل', push: 'اعلان پوش' };
var AUD_FA = { all: 'همه‌ی بزرگسال‌ها', bale_linked: 'بزرگسال‌های وصل‌شده به بله', user: 'یک بازیکن', kid: 'کودک‌ها', teen: 'نوجوان‌ها' };
VIEWS.messages = function (root) {
  var title = h('input', { type: 'text', placeholder: 'عنوان', maxlength: 150 }), text = h('textarea', { placeholder: 'متن پیام…', maxlength: 2000 });
  var aud = select([['all', AUD_FA.all], ['bale_linked', AUD_FA.bale_linked], ['user', AUD_FA.user], ['kid', AUD_FA.kid], ['teen', AUD_FA.teen]], 'all');
  var target = h('input', { type: 'text', dir: 'ltr', placeholder: 'شناسه‌ی بازیکن (از بخش کاربران)', style: 'display:none' });
  aud.addEventListener('change', function () { target.style.display = aud.value === 'user' ? '' : 'none'; });
  var chBox = h('div', { style: 'display:flex;flex-direction:column;gap:6px' }), checks = {};
  var hist = h('div');
  function showRecipients(m) {
    api('/admin/messages/' + m.id + '/recipients').then(function (r) {
      if (!r.ok) return fail(r);
      var list = r.body.recipients;
      if (!list.length) return alert('برای این پیام گیرنده‌ی صندوق ثبت نشده (کانال‌های دیگر فقط تعداد را نگه می‌دارند).');
      alert('«' + m.title + '» به ' + fa(list.length) + ' بازیکن رسید:\n' + list.map(function (x) { return (x.nickname || x.userId) + (x.read ? ' ✓' : ''); }).join('، ') + '\n(✓ = خوانده)');
    });
  }
  function drawHistory() {
    api('/admin/messages').then(function (r) {
      clear(hist);
      if (r.status === 404) return hist.appendChild(empty('مرکز پیام روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      if (!r.body.messages.length) return hist.appendChild(empty('هنوز پیامی نفرستاده‌ای'));
      hist.appendChild(h('div', { class: 'tbl-wrap' }, [h('table', {}, [h('thead', {}, [h('tr', {}, ['زمان', 'عنوان', 'مخاطب', 'کانال‌ها', ''].map(function (x) { return h('th', { text: x }); }))]),
        h('tbody', {}, r.body.messages.map(function (m) {
          return h('tr', {}, [h('td', { text: ago(m.sentAt) }), h('td', {}, [h('b', { text: m.title }), h('div', { class: 'sub', style: 'color:var(--muted);font-size:12px', text: m.body.slice(0, 80) })]),
            h('td', { text: AUD_FA[m.audience] || m.audience }),
            h('td', {}, m.channels.map(function (c) { return badge((CH_FA[c.channel] || c.channel) + ' ' + fa(c.recipients), 'b-info'); })),
            h('td', {}, [h('button', { class: 'btn sm', text: 'گیرنده‌ها', onclick: function () { showRecipients(m); } }), m.retracted ? badge('پس گرفته شد', 'b-mute') : h('button', { class: 'btn bad sm', text: 'پس گرفتن از صندوق', onclick: function () { if (confirm('این پیام از صندوق همه‌ی بازیکنان برداشته شود؟ (پیام‌های بله و ... که رفته‌اند برنمی‌گردند)')) api('/admin/messages/' + m.id, { method: 'DELETE' }).then(function (x) { if (!x.ok) return fail(x); drawHistory(); }); } })])]);
        }))])]));
    });
  }
  api('/admin/messages/channels').then(function (r) {
    if (!r.ok) return;
    r.body.channels.forEach(function (c) {
      var cb = h('input', { type: 'checkbox', disabled: !c.available, checked: c.channel === 'in_app' }); checks[c.channel] = cb;
      chBox.appendChild(h('label', { style: 'display:flex;gap:8px;align-items:center;' + (c.available ? '' : 'opacity:.55') }, [cb, h('span', { text: CH_FA[c.channel] }), c.available ? null : h('span', { class: 'sub', style: 'color:var(--muted);font-size:12px', text: '— ' + c.reason })]));
    });
  });
  root.appendChild(card('پیام جدید', 'یک پیام، چند کانال. کانال‌هایی که هنوز راه نیفتاده‌اند خاموش‌اند و دلیلشان کنارشان نوشته شده.', [
    h('div', { class: 'form-grid' }, [field('عنوان', title), field('مخاطب', aud)]), target, field('متن', text), field('کانال‌ها', chBox),
    h('div', { class: 'toolbar' }, [h('button', { class: 'btn primary', text: 'ارسال', onclick: function () {
      var chans = Object.keys(checks).filter(function (k) { return checks[k].checked && !checks[k].disabled; });
      if (!title.value.trim() || !text.value.trim() || !chans.length) return toast('عنوان، متن و دست‌کم یک کانال لازم است', true);
      if (!confirm('پیام برای «' + AUD_FA[aud.value] + '» فرستاده شود؟')) return;
      api('/admin/messages', { method: 'POST', body: { title: title.value.trim(), body: text.value.trim(), audience: aud.value, targetUserId: aud.value === 'user' ? target.value.trim() : null, channels: chans } }).then(function (x) {
        if (x.status === 409) return toast('مخاطبی پیدا نشد', true);
        if (!x.ok) return fail(x);
        toast('فرستاده شد: ' + Object.keys(x.body.recipients).map(function (k) { return CH_FA[k] + ' ' + fa(x.body.recipients[k]); }).join('، '));
        title.value = ''; text.value = ''; drawHistory();
      });
    } })])
  ]));
  root.appendChild(card('پیام‌های فرستاده‌شده', 'می‌توانی پیام صندوق داخل اپ را پس بگیری', [hist]));
  drawHistory();
};
VIEWS.admins = function (root) {
  var box = h('div');
  var ROLES = [['owner', 'مالک — همه‌چیز'], ['editor', 'ویرایشگر — کاتالوگ، قیمت، ربات، فیلتر، پیام'], ['support', 'پشتیبان — کاربران'], ['viewer', 'فقط‌خواندن']];
  function draw() {
    api('/admin/admins').then(function (r) {
      clear(box);
      if (!r.ok) return fail(r);
      if (r.body.legacyToken) box.appendChild(h('div', { class: 'flag', text: 'توکن اصلی (ADMIN_TOKEN) هنوز فعال است و دسترسی کامل دارد. بعد از ساختن حساب مالک، آن را از .env بردار.' }));
      if (!r.body.admins.length) box.appendChild(empty('هنوز حسابی نیست'));
      else box.appendChild(h('div', { class: 'tbl-wrap' }, [h('table', {}, [h('thead', {}, [h('tr', {}, ['نام', 'نام کاربری', 'نقش', 'آخرین ورود', 'وضعیت', ''].map(function (x) { return h('th', { text: x }); }))]),
        h('tbody', {}, r.body.admins.map(function (a) {
          var roleSel = select(ROLES, a.role);
          roleSel.addEventListener('change', function () { api('/admin/admins/' + a.id, { method: 'PUT', body: { role: roleSel.value } }).then(function (x) { if (!x.ok) fail(x); else toast('نقش عوض شد'); draw(); }); });
          return h('tr', {}, [h('td', {}, [h('b', { text: a.displayName })]), h('td', { class: 'ltr', text: a.username }), h('td', {}, [roleSel]), h('td', { text: a.lastLoginAt ? ago(a.lastLoginAt) : 'هرگز' }),
            h('td', {}, [a.locked ? badge('قفل', 'b-warn') : a.isActive ? badge('فعال', 'b-ok') : badge('غیرفعال', 'b-mute')]),
            h('td', {}, [
              h('button', { class: 'btn sm', text: a.isActive ? 'غیرفعال' : 'فعال', onclick: function () { api('/admin/admins/' + a.id, { method: 'PUT', body: { isActive: !a.isActive } }).then(function (x) { if (!x.ok) fail(x); draw(); }); } }), ' ',
              h('button', { class: 'btn sm', text: 'رمز تازه', onclick: function () { var pw = prompt('رمز تازه برای ' + a.username + ' (حداقل ۱۰ نویسه):'); if (!pw) return; api('/admin/admins/' + a.id + '/password', { method: 'POST', body: { password: pw } }).then(function (x) { if (!x.ok) fail(x); else toast('رمز عوض شد و نشست‌های قبلی بسته شد'); draw(); }); } })
            ])]);
        }))])]));
    });
  }
  var un = h('input', { type: 'text', dir: 'ltr', placeholder: 'نام کاربری (انگلیسی)', maxlength: 30 }), dn = h('input', { type: 'text', placeholder: 'نام نمایشی', maxlength: 60 }), pw = h('input', { type: 'password', dir: 'ltr', placeholder: 'رمز (حداقل ۱۰ نویسه)', autocomplete: 'new-password' }), role = select(ROLES, 'support');
  root.appendChild(box);
  root.appendChild(addCard('حساب تازه', 'هر مدیر حساب جدا دارد و کارهایش با اسمش در «گزارش تغییرها» ثبت می‌شود.', 'حساب تازه', [['نام کاربری', un], ['نام نمایشی', dn], ['رمز', pw], ['نقش', role]], function () {
    return api('/admin/admins', { method: 'POST', body: { username: un.value.trim(), displayName: dn.value.trim() || un.value.trim(), password: pw.value, role: role.value } }).then(function (x) { if (!x.ok) { fail(x); return false; } toast('حساب ساخته شد'); un.value = ''; dn.value = ''; pw.value = ''; draw(); return true; });
  }));
  draw();
};
`;
